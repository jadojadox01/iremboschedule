function serialize(value) {
  if (value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}

function dateValue(value) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function normalizeComparable(schedule) {
  return {
    center: schedule.center || null,
    location: schedule.location || null,
    category: schedule.category || null,
    startDateTime: dateValue(schedule.startDateTime),
    endDateTime: dateValue(schedule.endDateTime),
    remainingCapacity:
      schedule.remainingCapacity === null || schedule.remainingCapacity === undefined
        ? null
        : Number(schedule.remainingCapacity),
    maximumCapacity:
      schedule.maximumCapacity === null || schedule.maximumCapacity === undefined
        ? null
        : Number(schedule.maximumCapacity)
  };
}

function fieldChange(scheduleId, type, oldValue, newValue) {
  return {
    scheduleId,
    type,
    oldValue: serialize(oldValue),
    newValue: serialize(newValue)
  };
}

export function compareSchedules(previousSchedules, latestSchedules) {
  const changes = [];
  const previousById = new Map(previousSchedules.map((item) => [item.scheduleId, item]));
  const latestById = new Map(latestSchedules.map((item) => [item.scheduleId, item]));

  for (const latest of latestSchedules) {
    const previous = previousById.get(latest.scheduleId);

    if (!previous) {
      changes.push(fieldChange(latest.scheduleId, "NEW_SCHEDULE", null, normalizeComparable(latest)));
      continue;
    }

    const oldSchedule = normalizeComparable(previous);
    const newSchedule = normalizeComparable(latest);

    if (oldSchedule.remainingCapacity !== newSchedule.remainingCapacity) {
      const type =
        (newSchedule.remainingCapacity || 0) > (oldSchedule.remainingCapacity || 0)
          ? "CAPACITY_INCREASE"
          : "CAPACITY_DECREASE";
      changes.push(
        fieldChange(latest.scheduleId, type, oldSchedule.remainingCapacity, newSchedule.remainingCapacity)
      );
    }

    const updatedFields = {};
    for (const field of ["center", "location", "category", "startDateTime", "endDateTime", "maximumCapacity"]) {
      if (oldSchedule[field] !== newSchedule[field]) {
        updatedFields[field] = {
          oldValue: oldSchedule[field],
          newValue: newSchedule[field]
        };
      }
    }

    if (Object.keys(updatedFields).length > 0) {
      changes.push(fieldChange(latest.scheduleId, "SCHEDULE_UPDATED", null, updatedFields));
    }
  }

  for (const previous of previousSchedules) {
    if (!latestById.has(previous.scheduleId)) {
      changes.push(
        fieldChange(previous.scheduleId, "REMOVED_SCHEDULE", normalizeComparable(previous), null)
      );
    }
  }

  return changes;
}
