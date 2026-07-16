import { getStatus } from "../../../services/monitorService.js";
import { logger } from "../../../lib/logger.js";

export async function GET() {
  try {
    return Response.json(await getStatus());
  } catch (error) {
    logger.error("Status request failed", { message: error.message });
    return Response.json({ ok: false, error: "STATUS_FAILED" }, { status: 500 });
  }
}
