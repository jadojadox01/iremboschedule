import { listSchedules } from "../../../services/monitorService.js";
import { logger } from "../../../lib/logger.js";

export async function GET() {
  try {
    return Response.json({
      ok: true,
      schedules: await listSchedules()
    });
  } catch (error) {
    logger.error("Schedules request failed", { message: error.message });
    return Response.json({ ok: false, error: "SCHEDULES_FAILED" }, { status: 500 });
  }
}
