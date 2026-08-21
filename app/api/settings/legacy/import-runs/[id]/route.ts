import { requireCapability, validSameOrigin } from "../../../../../../lib/auth.ts";
import { getMongo } from "../../../../../../lib/mongodb.ts";
import { advanceLegacyImportRun } from "../../../../../../legacy/import-run.ts";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const denied=requireCapability(request,"settings.legacy.import");if(denied)return denied;if(!validSameOrigin(request))return Response.json({error:"طلب غير صالح"},{status:403});try{return Response.json(await advanceLegacyImportRun(await getMongo(),(await params).id));}catch(error){const e=error as Error&{status?:number};return Response.json({error:e.message},{status:e.status??500});}}
