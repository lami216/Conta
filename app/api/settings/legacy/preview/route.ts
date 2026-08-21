import { requireCapability, validSameOrigin } from "../../../../../lib/auth.ts";
import { inspectLegacyDatabase, MAX_LEGACY_BYTES } from "../../../../../legacy/dataacc-sqlite.ts";
export const runtime="nodejs";
export async function POST(request:Request){const denied=requireCapability(request,"settings.legacy.import");if(denied)return denied;if(!validSameOrigin(request))return Response.json({error:"طلب غير صالح"},{status:403});try{const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.byteLength>MAX_LEGACY_BYTES)throw new Error("الملف أكبر من الحد المسموح");return Response.json(await inspectLegacyDatabase(bytes));}catch(e){return Response.json({error:e instanceof Error?e.message:"ملف غير صالح"},{status:400});}}
