import axios from "axios";
import { logger } from "../lib/logger.js";

function parseJson(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function textIncludes(value, term) {
  return String(value || "").toLowerCase().includes(String(term || "").toLowerCase());
}

function isPrioritySchedule(schedule) {
  const priorityCategory = process.env.PRIORITY_CATEGORY || "A";
  const priorityCenter = process.env.PRIORITY_CENTER || "BUSANZA AUTOMATED CENTER";
  const priorityLocation = process.env.PRIORITY_LOCATION || "Busanza";

  return (
    schedule &&
    String(schedule.category || "").toUpperCase() === priorityCategory.toUpperCase() &&
    (textIncludes(schedule.center, priorityCenter) || textIncludes(schedule.location, priorityLocation)) &&
    Number(schedule.remainingCapacity || 0) > 0
  );
}

function priorityScheduleFromChange(change, latestById) {
  if (!["NEW_SCHEDULE", "CAPACITY_INCREASE"].includes(change.type)) {
    return null;
  }

  const latestSchedule = latestById.get(change.scheduleId);
  if (latestSchedule) {
    return latestSchedule;
  }

  return parseJson(change.newValue);
}

async function sendWebhookAlert(notification) {
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      status: "PENDING_WEBHOOK_CONFIG"
    };
  }

  await axios.post(
    webhookUrl,
    {
      ...notification,
      targets: {
        phone: process.env.ALERT_PHONE || "",
        email: process.env.ALERT_EMAIL || ""
      }
    },
    {
      timeout: 10000
    }
  );

  return {
    status: "SENT_WEBHOOK"
  };
}

export async function prepareNotifications(changes, latestSchedules = []) {
  const latestById = new Map(latestSchedules.map((schedule) => [schedule.scheduleId, schedule]));
  const notifications = changes.map((change) => ({
    scheduleId: change.scheduleId,
    type: change.type,
    oldValue: change.oldValue,
    newValue: change.newValue,
    preparedAt: new Date().toISOString(),
    status: "PENDING"
  }));
  const priorityNotifications = [];

  for (const change of changes) {
    const schedule = priorityScheduleFromChange(change, latestById);

    if (!isPrioritySchedule(schedule)) {
      continue;
    }

    const notification = {
      scheduleId: change.scheduleId,
      type: "NEW_DETECTED_CODES_FOR_BUSANZA_CATEGORY_A",
      changeType: change.type,
      schedule,
      preparedAt: new Date().toISOString(),
      targets: {
        phone: process.env.ALERT_PHONE || "",
        email: process.env.ALERT_EMAIL || ""
      },
      status: "PENDING"
    };

    try {
      const delivery = await sendWebhookAlert(notification);
      notification.status = delivery.status;
    } catch (error) {
      notification.status = "FAILED_WEBHOOK";
      notification.error = error.message;
      logger.error("Priority alert delivery failed", {
        scheduleId: change.scheduleId,
        message: error.message
      });
    }

    priorityNotifications.push(notification);
  }

  if (notifications.length > 0) {
    logger.info("Prepared schedule change notifications", {
      count: notifications.length,
      priorityCount: priorityNotifications.length
    });
  }

  return {
    notifications,
    priorityNotifications
  };
}
