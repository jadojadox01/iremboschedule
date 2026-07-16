import { listChanges } from "../../../services/monitorService.js";
import { logger } from "../../../lib/logger.js";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 50);
    return Response.json({
      ok: true,
      changes: await listChanges(Number.isFinite(limit) ? limit : 50)
    });
  } catch (error) {
    logger.error("Changes request failed", { message: error.message });
    return Response.json({ ok: false, error: "CHANGES_FAILED" }, { status: 500 });
  }
}
