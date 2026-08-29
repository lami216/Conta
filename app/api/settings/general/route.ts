import { requireCapability, validSameOrigin } from "../../../../lib/auth";
import { saveGeneralSettings } from "../../../../lib/general-settings";
import { getMongo } from "../../../../lib/mongodb";

export async function PUT(request: Request) {
  const denied = await requireCapability(request, "settings.general.manage");
  if (denied) return denied;
  if (!validSameOrigin(request)) return Response.json({ error: "طلب غير صالح" }, { status: 403 });
  try {
    return Response.json({ generalSettings: await saveGeneralSettings(await getMongo(), await request.json()) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "تعذر حفظ الإعدادات" }, { status: 400 });
  }
}
