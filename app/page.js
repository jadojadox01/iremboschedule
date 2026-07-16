import Dashboard from "@/components/Dashboard";
import { getStatus, listChanges, listSchedules } from "../services/monitorService.js";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [status, schedules, changes] = await Promise.all([
    getStatus().catch(() => ({ ok: false, status: "DATABASE_NOT_READY" })),
    listSchedules().catch(() => []),
    listChanges(200).catch(() => [])
  ]);

  return <Dashboard initialStatus={status} initialSchedules={schedules} initialChanges={changes} />;
}
