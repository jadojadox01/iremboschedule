"use client";

import { useEffect, useMemo, useState } from "react";
import StatusPill from "@/components/StatusPill";

function formatDate(value) {
  if (!value) {
    return "Never";
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function parseChangeValue(value) {
  if (!value) {
    return "";
  }
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return value;
  }
}

export default function Dashboard({ initialStatus, initialSchedules, initialChanges }) {
  const [status, setStatus] = useState(initialStatus);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [changes, setChanges] = useState(initialChanges);
  const [scheduleFilter, setScheduleFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [isFetching, setIsFetching] = useState(false);

  const remainingSlots = useMemo(
    () =>
      schedules.reduce((total, schedule) => {
        return total + (Number(schedule.remainingCapacity) || 0);
      }, 0),
    [schedules]
  );

  const categoryOptions = useMemo(() => {
    const categories = new Set(["A", "B", "C", "D", "E", "F"]);
    for (const change of changes) {
      const oldSchedule = parseChangeObject(change.oldValue);
      const newSchedule = parseChangeObject(change.newValue);
      if (oldSchedule.category) {
        categories.add(oldSchedule.category);
      }
      if (newSchedule.category) {
        categories.add(newSchedule.category);
      }
    }
    return ["all", ...[...categories].sort()];
  }, [changes, schedules]);

  const siteOptions = useMemo(() => {
    const centers = new Set(schedules.map((schedule) => schedule.center).filter(Boolean));
    for (const change of changes) {
      const oldSchedule = parseChangeObject(change.oldValue);
      const newSchedule = parseChangeObject(change.newValue);
      if (oldSchedule.center) {
        centers.add(oldSchedule.center);
      }
      if (newSchedule.center) {
        centers.add(newSchedule.center);
      }
    }
    return ["all", ...[...centers].sort()];
  }, [changes, schedules]);

  const busanzaSchedules = useMemo(
    () => schedules.filter((schedule) => isBusanzaSchedule(schedule, status?.monitor?.priority)),
    [schedules, status]
  );

  const busanzaCategoryASchedules = useMemo(
    () => schedules.filter((schedule) => isPriorityBusanzaSchedule(schedule, status?.monitor?.priority)),
    [schedules, status]
  );

  const scheduleRows = useMemo(() => {
    let rows;

    if (scheduleFilter === "active") {
      rows = schedules.map((schedule) => ({
        ...schedule,
        rowType: "ACTIVE"
      }));
    } else if (scheduleFilter === "removed") {
      rows = changes
        .filter((change) => change.type === "REMOVED_SCHEDULE")
        .map((change) => {
          const oldSchedule = parseChangeObject(change.oldValue);
          return {
            scheduleId: change.scheduleId,
            ...oldSchedule,
            rowType: "REMOVED",
            lastSeen: change.createdAt
          };
        });
    } else {
      const schedulesById = new Map(schedules.map((schedule) => [schedule.scheduleId, schedule]));
      rows = changes
        .filter((change) => change.type !== "REMOVED_SCHEDULE")
        .map((change) => {
          const activeSchedule = schedulesById.get(change.scheduleId);
          const createdSchedule = change.type === "NEW_SCHEDULE" ? parseChangeObject(change.newValue) : null;
          return {
            scheduleId: change.scheduleId,
            ...(activeSchedule || createdSchedule || {}),
            rowType: change.type,
            lastSeen: activeSchedule?.lastSeen || change.createdAt
          };
        });
    }

    return rows.filter((schedule) => {
      const matchesCategory = categoryFilter === "all" || schedule.category === categoryFilter;
      const matchesSite =
        siteFilter === "all" ||
        schedule.center === siteFilter;
      return matchesCategory && matchesSite;
    });
  }, [categoryFilter, changes, scheduleFilter, schedules, siteFilter, status]);

  async function refresh() {
    setIsFetching(true);
    try {
      const [statusResponse, schedulesResponse, changesResponse] = await Promise.all([
        fetch("/api/status"),
        fetch("/api/schedules"),
        fetch("/api/changes?limit=200")
      ]);

      const [nextStatus, nextSchedules, nextChanges] = await Promise.all([
        statusResponse.json(),
        schedulesResponse.json(),
        changesResponse.json()
      ]);

      setStatus(nextStatus);
      setSchedules(nextSchedules.schedules || []);
      setChanges(nextChanges.changes || []);
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    const handleFocus = () => refresh();

    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f9fb] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">Monitoring only</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">
              Irembo Schedule Availability Monitor
            </h1>
          </div>
          <StatusPill tone="good">Automatic detection</StatusPill>
        </header>

        <section className="grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase text-slate-500">System status</p>
            <div className="mt-3">
              <StatusPill tone={status?.ok ? "good" : "warn"}>{status?.status || "Unknown"}</StatusPill>
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase text-slate-500">Last scan</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{formatDate(status?.lastScanAt)}</p>
          </div>
          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase text-slate-500">Known schedules</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{schedules.length}</p>
          </div>
          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase text-slate-500">Remaining slots</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{remainingSlots}</p>
          </div>
        </section>

        <section className="mb-6 rounded border border-slate-200 bg-white p-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Service</p>
              <p className="mt-1 font-medium text-slate-900">{status?.monitor?.service || "PRACTICAL_EXAM"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Category</p>
              <p className="mt-1 font-medium text-slate-900">
                {(status?.monitor?.categories || ["A", "B"]).join(", ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Location mode</p>
              <p className="mt-1 font-medium text-slate-900">
                {status?.monitor?.locationMode || "AUTOMATIC"} ({status?.monitor?.locationCount || 0})
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Beneficiaries</p>
              <p className="mt-1 font-medium text-slate-900">
                {status?.monitor?.beneficiaries || "PrivateCandidate"}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded border border-teal-200 bg-teal-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-teal-700">Priority watch</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                New detected codes for Busanza
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {busanzaSchedules.length} Busanza schedules currently detected. {" "}
                {busanzaCategoryASchedules.length} are Category A priority matches.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button
                onClick={() => {
                  setScheduleFilter("active");
                  setCategoryFilter("all");
                  setSiteFilter(status?.monitor?.priority?.center || "BUSANZA AUTOMATED CENTER");
                }}
                className="inline-flex h-10 w-full items-center justify-center rounded border border-teal-700 bg-white px-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 sm:w-auto"
              >
                Show Busanza
              </button>
              <button
                onClick={() => {
                  setScheduleFilter("active");
                  setCategoryFilter(status?.monitor?.priority?.category || "A");
                  setSiteFilter(status?.monitor?.priority?.center || "BUSANZA AUTOMATED CENTER");
                }}
                className="inline-flex h-10 w-full items-center justify-center rounded border border-teal-700 bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800 sm:w-auto"
              >
                Show Busanza A
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]">
          <div>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Schedules</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Live updates every 10 seconds while this page is open.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-white p-1">
                {[
                  ["active", "Current", schedules.length],
                  ["changed", "Changed", changes.filter((change) => change.type !== "REMOVED_SCHEDULE").length],
                  ["removed", "Removed", changes.filter((change) => change.type === "REMOVED_SCHEDULE").length]
                ].map(([value, label, count]) => (
                  <button
                    key={value}
                    onClick={() => setScheduleFilter(value)}
                    className={`h-9 rounded px-3 text-sm font-medium transition ${
                      scheduleFilter === value
                        ? "bg-teal-700 text-white"
                        : "bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {label} {count}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3 grid gap-3 rounded border border-slate-200 bg-white p-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Category
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-700"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category === "all" ? "All categories" : `Category ${category}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Site
                <select
                  value={siteFilter}
                  onChange={(event) => setSiteFilter(event.target.value)}
                  className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-700"
                >
                  <option value="all">All sites</option>
                  {siteOptions
                    .filter((site) => site !== "all")
                    .map((site) => (
                      <option key={site} value={site}>
                        {site}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="mb-4 overflow-hidden rounded border border-slate-200 bg-white sm:hidden">
              {scheduleRows.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-500">No rows for this filter.</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {scheduleRows.map((schedule) => (
                    <article key={schedule.scheduleId} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{schedule.center || "Unknown"}</p>
                          <p className="mt-0.5 text-sm text-slate-600">{schedule.location || "Unknown"}</p>
                        </div>
                        <StatusPill tone={schedule.rowType === "REMOVED" ? "warn" : "neutral"}>
                          {schedule.rowType}
                        </StatusPill>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">Category</span>
                          <span>{schedule.category || "-"}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">Start</span>
                          <span>{formatDate(schedule.startDateTime)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">Capacity</span>
                          <span>{schedule.remainingCapacity ?? "-"} / {schedule.maximumCapacity ?? "-"}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">Last seen</span>
                          <span>{formatDate(schedule.lastSeen)}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
            <div className="overflow-hidden rounded border border-slate-200 bg-white hidden sm:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Center</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Start</th>
                      <th className="px-4 py-3">Capacity</th>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Last seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scheduleRows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan="7">
                          No rows for this filter.
                        </td>
                      </tr>
                    ) : (
                      scheduleRows.map((schedule) => (
                        <tr key={schedule.scheduleId} className="align-top">
                          <td className="px-4 py-3 font-medium text-slate-900">{schedule.center || "Unknown"}</td>
                          <td className="px-4 py-3 text-slate-600">{schedule.location || "Unknown"}</td>
                          <td className="px-4 py-3 text-slate-600">{schedule.category || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(schedule.startDateTime)}</td>
                          <td className="px-4 py-3 text-slate-900">
                            {schedule.remainingCapacity ?? "-"} / {schedule.maximumCapacity ?? "-"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill tone={schedule.rowType === "REMOVED" ? "warn" : "neutral"}>
                              {schedule.rowType}
                            </StatusPill>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(schedule.lastSeen)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside>
            <div className="sticky top-4 z-10 mb-3 rounded-b border-b border-slate-200 bg-[#f7f9fb] px-4 py-3 sm:static sm:border-none sm:bg-transparent sm:px-0 sm:py-0">
              <div className="flex items-center justify-between gap-4 sm:block">
                <h2 className="text-base font-semibold text-slate-950">Change logs</h2>
                <StatusPill>{changes.length} latest</StatusPill>
              </div>
            </div>
            <div className="rounded border border-slate-200 bg-white">
              {changes.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">No changes recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {changes.map((change) => (
                    <article key={change.id} className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={change.type === "CAPACITY_INCREASE" ? "good" : "neutral"}>
                          {change.type}
                        </StatusPill>
                        <span className="text-xs text-slate-500">{formatDate(change.createdAt)}</span>
                      </div>
                      <p className="mt-2 break-all text-xs font-medium text-slate-500">{change.scheduleId}</p>
                      <p className="mt-2 break-words text-xs leading-5 text-slate-600">
                        {parseChangeValue(change.oldValue)} to {parseChangeValue(change.newValue)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function parseChangeObject(value) {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isPriorityBusanzaSchedule(schedule, priority = {}) {
  const category = priority.category || "A";

  return (
    isBusanzaSchedule(schedule, priority) &&
    String(schedule.category || "").toUpperCase() === category.toUpperCase()
  );
}

function isBusanzaSchedule(schedule, priority = {}) {
  const center = priority.center || "BUSANZA AUTOMATED CENTER";
  const location = priority.location || "Busanza";

  return (
    schedule &&
    (String(schedule.center || "").toLowerCase().includes(center.toLowerCase()) ||
      String(schedule.location || "").toLowerCase().includes(location.toLowerCase())) &&
    Number(schedule.remainingCapacity || 0) > 0
  );
}
