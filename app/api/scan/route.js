import { runScan } from "../../../services/monitorService.js";
import { logger } from "../../../lib/logger.js";

export async function POST(request) {
  try {
    const scanSecret = process.env.SCAN_API_SECRET;
    if (scanSecret) {
      const providedSecret = request.headers.get("x-scan-secret");
      if (providedSecret !== scanSecret) {
        return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const result = await runScan(body);
    return Response.json(result);
  } catch (error) {
    logger.error("Scan failed", { message: error.message });
    return Response.json(
      {
        ok: false,
        error: "SCAN_FAILED",
        message: error.message
      },
      { status: 500 }
    );
  }
}
