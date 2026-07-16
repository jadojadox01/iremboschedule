import axios from "axios";
import { logger } from "../lib/logger.js";

const IREMBO_API_URL =
  "https://irembo.gov.rw/irembo/rest/public/police/v2/request/all-schedules";

let sessionCookie = "";

const DEFAULT_LOCATIONS = [
  "Bugesera",
  "Burera",
  "Gakenke",
  "Gasabo",
  "Gatsibo",
  "Gicumbi",
  "Gisagara",
  "Huye",
  "Kamonyi",
  "Karongi",
  "Kayonza",
  "Kicukiro",
  "Kirehe",
  "Muhanga",
  "Musanze",
  "Ngoma",
  "Ngororero",
  "Nyabihu",
  "Nyagatare",
  "Nyamagabe",
  "Nyamasheke",
  "Nyanza",
  "Nyarugenge",
  "Nyaruguru",
  "Rubavu",
  "Ruhango",
  "Rulindo",
  "Rusizi",
  "Rutsiro",
  "Rwamagana"
];

const DEFAULT_CATEGORIES = ["A", "B", "C", "D", "E", "F"];

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = [];
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}

export function getMonitoredLocations(options = {}) {
  if (options.location) {
    return uniqueValues([options.location]);
  }

  if (Array.isArray(options.locations) && options.locations.length > 0) {
    return uniqueValues(options.locations);
  }

  if (process.env.IREMBO_LOCATIONS) {
    return uniqueValues(process.env.IREMBO_LOCATIONS.split(","));
  }

  return DEFAULT_LOCATIONS;
}

export function getMonitoredCategories(options = {}) {
  if (options.category) {
    return uniqueValues([options.category]);
  }

  if (Array.isArray(options.categories) && options.categories.length > 0) {
    return uniqueValues(options.categories);
  }

  if (process.env.IREMBO_CATEGORIES) {
    return uniqueValues(process.env.IREMBO_CATEGORIES.split(","));
  }

  return DEFAULT_CATEGORIES;
}

function firstValue(source, keys) {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return null;
}

function asInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asDate(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pickRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.data?.schedules)) {
    return payload.data.schedules;
  }
  if (Array.isArray(payload?.data?.content)) {
    return payload.data.content;
  }
  if (Array.isArray(payload?.data?.items)) {
    return payload.data.items;
  }
  if (Array.isArray(payload?.content)) {
    return payload.content;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  return [];
}

function normalizeSchedule(row, sourceLocation, sourceCategory) {
  const rawScheduleId = String(
    firstValue(row, ["scheduleId", "id", "code", "scheduleCode", "slotId"]) || ""
  ).trim();
  const location = firstValue(row, ["location", "district", "place"]) || sourceLocation;
  const center = firstValue(row, ["center", "testCenter", "examCenter", "drivingTestCenter", "site"]);
  const category = firstValue(row, ["category", "licenseCategory"]) || sourceCategory;
  const startDateTime = asDate(firstValue(row, ["startDateTime", "startTime", "startDate", "date"]));
  const fallbackScheduleId = [category, location, center, startDateTime?.toISOString()]
    .filter(Boolean)
    .join(":");

  return {
    scheduleId: rawScheduleId ? `${category}:${rawScheduleId}` : fallbackScheduleId,
    center,
    location,
    category,
    startDateTime,
    endDateTime: asDate(firstValue(row, ["endDateTime", "endTime", "endDate"])),
    remainingCapacity: asInteger(
      firstValue(row, ["remainingCapacity", "remainingSlots", "availableSlots", "availablePlaces"])
    ),
    maximumCapacity: asInteger(
      firstValue(row, ["maximumCapacity", "maxCapacity", "totalSlots", "capacity"])
    )
  };
}

function updateCookie(headers) {
  const cookies = headers?.["set-cookie"];
  if (!Array.isArray(cookies) || cookies.length === 0) {
    return;
  }
  sessionCookie = cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function publicErrorPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    status: payload.status,
    responseCode: payload.responseCode,
    message: payload.message,
    error: payload.error
  };
}

async function requestWithRetry(params, requestHeaders, attempt = 1) {
  try {
    const response = await axios.get(IREMBO_API_URL, {
      params,
      timeout: Number(process.env.IREMBO_REQUEST_TIMEOUT_MS || 8000),
      headers: {
        Accept: "application/json",
        ...requestHeaders,
        ...(sessionCookie ? { Cookie: sessionCookie } : {})
      },
      validateStatus: (status) => status >= 200 && status < 500
    });

    updateCookie(response.headers);

    if (response.status >= 400) {
      const publicError = publicErrorPayload(response.data);
      throw new Error(
        `Irembo API returned HTTP ${response.status}${
          publicError?.message ? `: ${publicError.message}` : ""
        }`
      );
    }

    return response.data;
  } catch (error) {
    if (attempt >= 3) {
      throw error;
    }
    const delayMs = 500 * attempt;
    logger.warn("Irembo request failed; retrying", {
      attempt,
      delayMs,
      message: error.message
    });
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return requestWithRetry(params, requestHeaders, attempt + 1);
  }
}

export async function fetchSchedules(options = {}) {
  const firstPage = options.page || 1;
  const limit = options.limit || Number(process.env.IREMBO_PAGE_LIMIT || 50);
  const maxPages = options.maxPages || Number(process.env.IREMBO_MAX_PAGES || 20);
  const concurrency = Number(options.concurrency || process.env.IREMBO_LOCATION_CONCURRENCY || 4);
  const locations = getMonitoredLocations(options);
  const categories = getMonitoredCategories(options);
  const baseHeaders = {
    service: options.service || process.env.IREMBO_SERVICE || "PRACTICAL_EXAM",
    beneficiaries:
      options.beneficiaries || process.env.IREMBO_BENEFICIARIES || "PrivateCandidate"
  };
  const baseParams = {
    limit
  };
  const scannedLocations = [];
  const failedLocations = [];
  const scannedScopes = [];
  const failedScopes = [];
  const scanTargets = categories.flatMap((category) =>
    locations.map((location) => ({ category, location }))
  );

  const locationResults = await mapWithConcurrency(scanTargets, concurrency, async ({ category, location }) => {
    const locationRows = [];
    let page = firstPage;

    try {
      while (true) {
        const payload = await requestWithRetry(
          { ...baseParams, page },
          { ...baseHeaders, category, location }
        );
        const rows = pickRows(payload);
        locationRows.push(...rows.map((row) => ({ row, sourceLocation: location, sourceCategory: category })));

        if (options.allPages === false || rows.length < limit || page - firstPage + 1 >= maxPages) {
          break;
        }

        page += 1;
      }
      scannedLocations.push(location);
      scannedScopes.push({ category, location });
    } catch (error) {
      failedLocations.push(location);
      failedScopes.push({ category, location });
      logger.error("Irembo location scan failed", {
        category,
        location,
        message: error.message
      });
    }

    return locationRows;
  });

  const schedulesById = new Map();

  for (const schedule of locationResults
    .flat()
    .map(({ row, sourceLocation, sourceCategory }) => normalizeSchedule(row, sourceLocation, sourceCategory))
    .filter((schedule) => schedule.scheduleId)) {
    schedulesById.set(schedule.scheduleId, schedule);
  }

  const schedules = [...schedulesById.values()];
  schedules.scanMeta = {
    scannedLocations: uniqueValues(scannedLocations),
    failedLocations: uniqueValues(failedLocations),
    scannedScopes,
    failedScopes,
    categories
  };

  return schedules;
}
