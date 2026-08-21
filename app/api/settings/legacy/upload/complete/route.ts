import { requireCapability, validSameOrigin } from "../../../../../../lib/auth.ts";
import { inspectLegacyDatabase } from "../../../../../../legacy/dataacc-sqlite.ts";
import { finishLegacyUpload } from "../../../../../../legacy/upload-store.ts";
import { getMongo } from "../../../../../../lib/mongodb.ts";
import { createLegacyImportRun } from "../../../../../../legacy/import-run.ts";
export const runtime = "nodejs";
export async function POST(request: Request) { const denied=requireCapability(request,"settings.legacy.import");if(denied)return denied;if(!validSameOrigin(request))return Response.json({error:"طلب غير صالح"},{status:403});try{const body=await request.json() as {uploadId:string;action:"preview"|"import";stockPolicy?:string};const bytes=await finishLegacyUpload(body.uploadId);if(body.action==="preview")return Response.json({...await inspectLegacyDatabase(bytes),uploadId:body.uploadId});if(body.action!=="import")throw new Error("عملية الرفع غير صالحة");return Response.json(await createLegacyImportRun(await getMongo(),body.uploadId,body.stockPolicy==="imported"?"imported":"current"),{status:202});}catch(e){console.error("Legacy SQLite upload failed",e);return Response.json({error:"تعذرت قراءة ملف SQLite. تأكد من صحة الملف ثم حاول مرة أخرى."},{status:400});} }
