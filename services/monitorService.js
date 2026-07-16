import { prisma } from "../lib/db.js";
import { compareSchedules } from "../lib/compare.js";
import { logger } from "../lib/logger.js";
import {
  fetchSchedules,
  getMonitoredCategories,
  getMonitoredLocations
} from "../providers/iremboProvider.js";
import { prepareNotifications } from "./notificationService.js";

function toScheduleWrite(schedule, scannedAt) {
  return {
    center: schedule.center,
    location: schedule.location,
    category: schedule.category,
    startDateTime: schedule.startDateTime,
    endDateTime: schedule.endDateTime,
    remainingCapacity: schedule.remainingCapacity,
    maximumCapacity: schedule.maximumCapacity,
    lastSeen: scannedAt
  };
}

export async function runScan(options = {}) {
  const startedAt = new Date();
  logger.info("Starting schedule scan", options);

  const previousSchedules = await prisma.schedule.findMany();
  const latestSchedules = await fetchSchedules(options);
  const scanMeta = latestSchedules.scanMeta || {
    scannedLocations: [],
    failedLocations: [],
    scannedScopes: [],
    failedScopes: []
  };
  const scannedScopeKeys = new Set(
    scanMeta.scannedScopes.map((scope) => `${scope.category}:${scope.location}`)
  );
  const comparablePreviousSchedules =
    scannedScopeKeys.size > 0
      ? previousSchedules.filter((schedule) =>
          scannedScopeKeys.has(`${schedule.category}:${schedule.location}`)
        )
      : previousSchedules;
  const changes = compareSchedules(comparablePreviousSchedules, latestSchedules);
  const notificationResult = await prepareNotifications(changes, latestSchedules);
  const latestScheduleIds = latestSchedules.map((schedule) => schedule.scheduleId);

  const snapshot = await prisma.$transaction(async (tx) => {
    const createdSnapshot = await tx.snapshot.create({
      data: {
        createdAt: startedAt
      }
    });

    for (const schedule of latestSchedules) {
      await tx.schedule.upsert({
        where: { scheduleId: schedule.scheduleId },
        update: toScheduleWrite(schedule, startedAt),
        create: {
          scheduleId: schedule.scheduleId,
          ...toScheduleWrite(schedule, startedAt)
        }
      });
    }

    if (scanMeta.scannedScopes.length > 0) {
      await tx.schedule.deleteMany({
        where: {
          OR: scanMeta.scannedScopes.map((scope) => ({
            category: scope.category,
            location: scope.location
          })),
          scheduleId: {
            notIn: latestScheduleIds
          }
        }
      });
    }

    if (changes.length > 0) {
      await tx.change.createMany({
        data: changes
      });
    }

    return createdSnapshot;
  }, {
    maxWait: 10000,
    timeout: 120000
  });

  logger.info("Finished schedule scan", {
    snapshotId: snapshot.id,
    scheduleCount: latestSchedules.length,
    changeCount: changes.length,
    notificationCount: notificationResult.notifications.length,
    priorityNotificationCount: notificationResult.priorityNotifications.length,
    scannedLocationCount: scanMeta.scannedLocations.length,
    failedLocationCount: scanMeta.failedLocations.length
  });

  return {
    ok: true,
    snapshotId: snapshot.id,
    scannedAt: startedAt.toISOString(),
    scheduleCount: latestSchedules.length,
    changeCount: changes.length,
    notificationCount: notificationResult.notifications.length,
    priorityNotificationCount: notificationResult.priorityNotifications.length,
    priorityNotifications: notificationResult.priorityNotifications,
    scannedLocationCount: scanMeta.scannedLocations.length,
    failedLocationCount: scanMeta.failedLocations.length,
    failedLocations: scanMeta.failedLocations,
    changes
  };
}

export async function getStatus() {
  const [lastSnapshot, scheduleCount, changeCount, latestChange] = await Promise.all([
    prisma.snapshot.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.schedule.count(),
    prisma.change.count(),
    prisma.change.findFirst({ orderBy: { createdAt: "desc" } })
  ]);
  const monitoredLocations = getMonitoredLocations();
  const monitoredCategories = getMonitoredCategories();

  return {
    ok: true,
    status: "READY",
    lastScanAt: lastSnapshot?.createdAt?.toISOString() || null,
    scheduleCount,
    changeCount,
    latestChangeAt: latestChange?.createdAt?.toISOString() || null,
    monitor: {
      service: process.env.IREMBO_SERVICE || "PRACTICAL_EXAM",
      categories: monitoredCategories,
      beneficiaries: process.env.IREMBO_BENEFICIARIES || "PrivateCandidate",
      locationMode: "AUTOMATIC",
      locationCount: monitoredLocations.length,
      locations: monitoredLocations,
      priority: {
        category: process.env.PRIORITY_CATEGORY || "A",
        center: process.env.PRIORITY_CENTER || "BUSANZA AUTOMATED CENTER",
        location: process.env.PRIORITY_LOCATION || "Busanza"
      }
    }
  };
}

export async function listSchedules() {
  return prisma.schedule.findMany({
    orderBy: [{ startDateTime: "asc" }, { scheduleId: "asc" }]
  });
}

export async function listChanges(limit = 50) {
  return prisma.change.findMany({
    orderBy: { createdAt: "desc" },
    take: limit
  });
}
