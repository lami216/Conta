import { getMongo } from "../../../lib/mongodb";
import { log } from "../../../lib/log";

export async function POST(request: Request) {
  let type = "unknown";
  try {
    const body = await request.json() as Record<string, unknown>;
    type = typeof body.type === "string" ? body.type : "unknown";
    log("info", "api.command.started", { commandType: type });
    // Commands are deliberately audited before processing; never log the request body.
    const db = await getMongo();
    await db.collection("auditEvents").insertOne({ action: type, createdAt: new Date() });
    log("error", "api.command.unsupported", { commandType: type });
    return Response.json({ error: "العملية غير مدعومة في هذا الإصدار" }, { status: 400 });
  } catch (error) {
    log("error", "api.command.failed", { commandType: type, error });
    return Response.json({ error: "تعذر تنفيذ العملية" }, { status: 500 });
  }
}
