import type { Db, Document, FindCursor } from "mongodb";
import type { ReportFilters, ReportResponse, ReportRow, ReportType } from "../app/report-types.ts";
import { isProductExpired } from "../app/domain.ts";
import { displayDocumentNumber } from "./document-sequences.ts";

const TYPES: ReportType[] = ["overview", "sales", "purchases", "product-sales", "stock", "profit", "debts", "party-ledger", "financial", "expenses", "returns"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (value: string | null) => (value ?? "").trim();
const n = (value: unknown) => Number(value ?? 0);
const isoDate = (value: string, next = false) => { const date = new Date(`${value}T00:00:00.000Z`); if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error("التاريخ غير صالح"); if (next) date.setUTCDate(date.getUTCDate() + 1); return date; };

export function parseReportFilters(url: URL): ReportFilters {
  const type = text(url.searchParams.get("type")) as ReportType;
  if (!TYPES.includes(type)) throw new Error("نوع التقرير غير صالح");
  const from = text(url.searchParams.get("from")), to = text(url.searchParams.get("to"));
  const allTime = url.searchParams.get("allTime") === "true", unpaged = url.searchParams.get("unpaged") === "true";
  if (type !== "debts" && !allTime && (!DATE.test(from) || !DATE.test(to))) throw new Error("الفترة مطلوبة");
  if (from && to && isoDate(from) > isoDate(to)) throw new Error("بداية الفترة يجب ألا تتجاوز نهايتها");
  if (from && to && (isoDate(to).valueOf() - isoDate(from).valueOf()) / 86400000 > 3660) throw new Error("الفترة طويلة جدًا");
  const page = Number(url.searchParams.get("page") ?? 1), pageSize = Number(url.searchParams.get("pageSize") ?? 100);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) throw new Error("إعدادات الصفحة غير صالحة");
  const pick = <T extends string>(key: string, allowed: T[], fallback?: T) => { const value = text(url.searchParams.get(key)); if (!value) return fallback; if (!allowed.includes(value as T)) throw new Error(`الفلتر ${key} غير صالح`); return value as T; };
  return { type, from: from || undefined, to: to || undefined, allTime, unpaged, partyId: text(url.searchParams.get("partyId")) || undefined, productId: text(url.searchParams.get("productId")) || undefined, paymentAccountId: text(url.searchParams.get("paymentAccountId")) || undefined, movementType: text(url.searchParams.get("movementType")) || undefined, direction: pick("direction", ["in", "out"]), groupBy: pick("groupBy", ["invoice", "product"], "invoice"), sortBy: pick("sortBy", ["quantity", "sales", "name", "profit"], "quantity"), debtSide: pick("debtSide", ["receivable", "payable", "clear"]), expenseType: pick("expenseType", ["once", "recurring"]), search: text(url.searchParams.get("search")) || undefined, page, pageSize };
}

const matchDate = (f: ReportFilters): Document => f.allTime ? {} : ({ $expr: { $and: [
  { $gte: [{ $convert: { input: "$occurredAt", to: "date", onError: null, onNull: null } }, isoDate(f.from!)] },
  { $lt: [{ $convert: { input: "$occurredAt", to: "date", onError: null, onNull: null } }, isoDate(f.to!, true)] },
] } });
const pagination = (totalRows: number, f: ReportFilters) => ({ page: f.unpaged ? 1 : f.page, pageSize: f.unpaged ? totalRows : f.pageSize, totalRows, totalPages: f.unpaged ? 1 : Math.max(1, Math.ceil(totalRows / f.pageSize)) });
const slice = <T>(rows: T[], f: ReportFilters) => f.unpaged ? rows : rows.slice((f.page - 1) * f.pageSize, f.page * f.pageSize);
const pageCursor = (cursor: FindCursor<Document>, f: ReportFilters) => f.unpaged ? cursor : cursor.skip((f.page - 1) * f.pageSize).limit(f.pageSize);
const lineMatches = (line: Document, f: ReportFilters) => !f.productId || String(line.productId) === f.productId;

type Cost = { unit: number | null; source: "snapshot" | "historical-purchase" | "unknown" };
async function resolveCost(db: Db, sale: Document, line: Document): Promise<Cost> {
  if (line.costAtSale !== null && line.costAtSale !== undefined && Number.isFinite(Number(line.costAtSale))) return { unit: n(line.costAtSale), source: "snapshot" };
  const purchase = await db.collection("documents").findOne({ kind: "purchase", status: "posted", occurredAt: { $lte: sale.occurredAt }, "lines.productId": line.productId }, { sort: { occurredAt: -1 }, projection: { lines: 1 } });
  const historical = (purchase?.lines as Document[] | undefined)?.find(item => String(item.productId) === String(line.productId));
  return historical && Number.isFinite(Number(historical.unitPrice)) ? { unit: n(historical.unitPrice), source: "historical-purchase" } : { unit: null, source: "unknown" };
}

async function saleFacts(db: Db, documents: Document[], f: ReportFilters) {
  const facts: ReportRow[] = [];
  const productIds = [...new Set(documents.flatMap(document => ((document.lines ?? []) as Document[]).map(line => String(line.productId ?? "")).filter(Boolean)))];
  const identities = new Map((await db.collection("products").find({ id: { $in: productIds } }).project({ id: 1, name: 1, sku: 1 }).toArray()).map(product => [String(product.id), product]));
  for (const document of documents) for (const line of (document.lines ?? []) as Document[]) {
    if (!lineMatches(line, f)) continue;
    const sign = document.kind === "return" ? -1 : 1;
    // Return snapshots normally carry the original line cost. Legacy returns that do
    // not carry it must resolve at the original sale date, never the return date.
    const originalSale = document.kind === "return" && document.parentDocumentId
      ? await db.collection("documents").findOne({ id: document.parentDocumentId, kind: "sale" }, { projection: { occurredAt: 1 } })
      : null;
    const cost = await resolveCost(db, originalSale ?? document, line);
    const revenue = sign * n(line.lineTotal), quantity = sign * n(line.quantity), costKnown = cost.unit !== null, cogs = sign * n(line.quantity) * (cost.unit ?? 0), profit = revenue - cogs;
    const identity = identities.get(String(line.productId));
    const productName = String(identity?.name ?? line.description ?? "").trim() || "منتج غير متاح";
    const sku = String(identity?.sku ?? line.sku ?? "").trim() || "—";
    facts.push({ id: `${document.id}-${line.id}`, documentId: String(document.id), parentDocumentId: String(document.parentDocumentId ?? ""), number: displayDocumentNumber(document), occurredAt: String(document.occurredAt), party: String(document.partyName ?? "بيع مباشر"), partyId: String(document.partyId ?? ""), paymentMethod: String(document.paymentMethod ?? ""), productId: String(line.productId), product: productName, sku, quantity, unitPrice: n(line.unitPrice), revenue, cost: cogs, profit, margin: revenue ? profit / revenue * 100 : 0, costKnown, costSource: cost.source, unknownRevenue: costKnown ? 0 : Math.abs(revenue) });
  }
  return facts;
}

function profitSummary(facts: ReportRow[]) {
  const revenue = facts.reduce((sum, row) => sum + n(row.revenue), 0), cost = facts.reduce((sum, row) => sum + n(row.cost), 0), profit = facts.reduce((sum, row) => sum + n(row.profit), 0);
  return { revenue, cost, profit, margin: revenue ? profit / revenue * 100 : 0, unknownRevenue: facts.reduce((sum, row) => sum + n(row.unknownRevenue), 0) };
}

/** Current expired stock is a non-cash inventory exposure: reporting never mutates stock or accounts. */
async function expiredInventoryLoss(db: Db) {
  const today = new Date().toISOString().slice(0, 10);
  const products = await db.collection("products").find({ expiryDate: { $type: "string", $lt: today }, isArchived: { $ne: true } }).toArray();
  return products.reduce((total, product) => {
    if (!isProductExpired(product, today)) return total;
    const remaining = Object.values((product.stocks ?? {}) as Record<string, number>).reduce((sum, quantity) => sum + Math.max(0, n(quantity)), 0);
    const cost = Number.isFinite(product.lastPurchaseCost) ? n(product.lastPurchaseCost) : Number.isFinite(product.pieceCost) ? n(product.pieceCost) : 0;
    return total + remaining * cost;
  }, 0);
}

async function directDocuments(db: Db, f: ReportFilters, kind: string) {
  const query: Document = { kind, status: "posted", ...matchDate(f) };
  if (f.paymentAccountId) query.paymentMethod = f.paymentAccountId;
  if (f.productId) query["lines.productId"] = f.productId;
  if (kind === "expense" && f.expenseType) query.recurringId = f.expenseType === "recurring" ? { $exists: true } : { $exists: false };
  const totalRows = await db.collection("documents").countDocuments(query);
  const rows = await pageCursor(db.collection("documents").find(query).sort({ occurredAt: -1 }), f).toArray();
  const all = await db.collection("documents").find(query).toArray();
  return { rows, all, totalRows };
}

export async function buildReport(db: Db, f: ReportFilters): Promise<ReportResponse> {
  const expiryLoss = ["stock", "profit", "overview"].includes(f.type) ? await expiredInventoryLoss(db) : 0;
  if (f.type === "sales") {
    const sales = await directDocuments(db, f, "sale");
    const returnQuery = { kind: "return", status: "posted", ...matchDate(f), ...(f.productId ? { "lines.productId": f.productId } : {}) };
    const returns = await db.collection("documents").find(returnQuery).toArray();
    const summaryFacts = await saleFacts(db, [...sales.all, ...returns], f), totals = profitSummary(summaryFacts);
    const rows = f.productId ? await saleFacts(db, sales.rows, f) : await Promise.all(sales.rows.map(async document => { const facts = await saleFacts(db, [document], f), p = profitSummary(facts); return { id: String(document.id), documentId: String(document.id), number: displayDocumentNumber(document), occurredAt: String(document.occurredAt), party: String(document.partyName ?? "بيع مباشر"), paymentMethod: String(document.paymentMethod ?? ""), total: n(document.total), cost: p.cost, profit: p.profit, margin: n(document.total) ? p.profit / n(document.total) * 100 : 0, paid: n(document.paidTotal), due: n(document.dueTotal) }; }));
    return { report: f.type, from: f.from!, to: f.to!, summary: { count: sales.totalRows, grossSales: sales.all.reduce((s, d) => s + (f.productId ? (d.lines as Document[]).filter(l => lineMatches(l, f)).reduce((x,l)=>x+n(l.lineTotal),0) : n(d.total)), 0), returns: returns.reduce((s,d)=>s+(d.lines as Document[]).filter(l=>lineMatches(l,f)).reduce((x,l)=>x+n(l.lineTotal),0),0), netSales: totals.revenue, cost: totals.cost, profit: totals.profit, margin: totals.margin, unknownRevenue: totals.unknownRevenue, paid: sales.all.reduce((s,d)=>s+n(d.paidTotal),0), due: sales.all.reduce((s,d)=>s+n(d.dueTotal),0) }, rows, meta: pagination(sales.totalRows, f) };
  }
  if (f.type === "purchases" || f.type === "expenses" || f.type === "returns") {
    const kind = f.type === "purchases" ? "purchase" : f.type === "expenses" ? "expense" : "return", found = await directDocuments(db, f, kind);
    const originals = f.type === "returns" ? new Map((await db.collection("documents").find({ id: { $in: found.rows.map(d => d.parentDocumentId) } }).project({ id: 1, number: 1 }).toArray()).map(d => [String(d.id), String(d.number)])) : new Map<string,string>();
    const productIds = [...new Set(found.rows.flatMap(document => ((document.lines ?? []) as Document[]).map(line => String(line.productId ?? "")).filter(Boolean)))];
    const identities = new Map((await db.collection("products").find({ id: { $in: productIds } }).project({ id: 1, name: 1, sku: 1 }).toArray()).map(product => [String(product.id), product]));
    const rows = found.rows.map(document => { const selected = ((document.lines ?? []) as Document[]).filter(line => lineMatches(line, f)); if (f.type === "returns") return { id: String(document.id), documentId: String(document.id), occurredAt: String(document.occurredAt), number: displayDocumentNumber(document), originalDocument: originals.get(String(document.parentDocumentId)) ?? "غير متاحة", party: String(document.partyName ?? ""), products: selected.length, quantity: selected.reduce((s,l)=>s+n(l.quantity),0), total: selected.reduce((s,l)=>s+n(l.lineTotal),0) }; if (f.type === "purchases" && f.productId) { const line=selected[0]; return { id:String(document.id),documentId:String(document.id),number:displayDocumentNumber(document),occurredAt:String(document.occurredAt),party:String(document.partyName??""),product:String(identities.get(String(line?.productId))?.name??line?.description??"").trim()||"منتج غير متاح",sku:String(identities.get(String(line?.productId))?.sku??line?.sku??"—")||"—",quantity:n(line?.quantity),unitPrice:n(line?.unitPrice),total:n(line?.lineTotal) }; } return { id:String(document.id),documentId:String(document.id),number:displayDocumentNumber(document),occurredAt:String(document.occurredAt),party:String(document.partyName??""),paymentMethod:String(document.paymentMethod??""),title:String(document.title??""),recurring:Boolean(document.recurringId),total:n(document.total),paid:n(document.paidTotal),due:n(document.dueTotal) }; });
    const value = (d: Document) => f.productId ? (d.lines as Document[]).filter(l=>lineMatches(l,f)).reduce((s,l)=>s+n(l.lineTotal),0) : n(d.total);
    return { report:f.type,from:f.from!,to:f.to!,summary:{count:found.totalRows,total:found.all.reduce((s,d)=>s+value(d),0),quantity:found.all.reduce((s,d)=>s+(d.lines as Document[]).filter(l=>lineMatches(l,f)).reduce((x,l)=>x+n(l.quantity),0),0),paid:found.all.reduce((s,d)=>s+n(d.paidTotal),0),due:found.all.reduce((s,d)=>s+n(d.dueTotal),0)},rows,meta:pagination(found.totalRows,f) };
  }
  if (f.type === "stock" || f.type === "financial") {
    const collection = f.type === "stock" ? "stockMovements" : "financialMovements", query: Document = matchDate(f);
    if (f.productId && f.type === "stock") query.productId=f.productId; if(f.movementType)query.type=f.movementType;if(f.paymentAccountId&&f.type==="financial")query.paymentMethod=f.paymentAccountId;if(f.direction&&f.type==="financial")query.direction=f.direction;
    const totalRows=await db.collection(collection).countDocuments(query), all=await db.collection(collection).find(query).toArray(), raw=await pageCursor(db.collection(collection).find(query).sort({occurredAt:-1}),f).toArray();
    let rows: ReportRow[];
    if(f.type==="stock"){const products=await db.collection("products").find({id:{$in:raw.map(x=>x.productId)}}).project({id:1,sku:1,name:1}).toArray(),identities=new Map(products.map(p=>[String(p.id),p]));rows=raw.map(x=>({id:String(x.id),documentId:String(x.documentId),occurredAt:String(x.occurredAt),sku:String(identities.get(String(x.productId))?.sku??x.sku??"—")||"—",product:String(identities.get(String(x.productId))?.name??x.productName??"").trim()||"منتج غير متاح",warehouse:String(x.warehouseName),movementType:String(x.type),before:n(x.balanceBefore),change:n(x.quantityDelta),after:n(x.balanceAfter),documentNumber:String(x.documentNumber)}));return{report:f.type,from:f.from!,to:f.to!,summary:{movements:totalRows,expiredInventoryLoss:expiryLoss,incoming:all.reduce((s,x)=>s+Math.max(0,n(x.quantityDelta)),0),outgoing:all.reduce((s,x)=>s+Math.abs(Math.min(0,n(x.quantityDelta))),0)},rows,meta:pagination(totalRows,f)};}
    rows=raw.map(x=>({id:String(x.id),documentId:String(x.documentId),occurredAt:String(x.occurredAt),paymentMethod:String(x.paymentMethod),movementType:String(x.type),incoming:x.direction==="in"?n(x.amount):0,outgoing:x.direction==="out"?n(x.amount):0,party:String(x.partyName??""),documentNumber:String(x.documentNumber??"")}));const operating=all.filter(x=>!String(x.type).startsWith("transfer-"));return{report:f.type,from:f.from!,to:f.to!,summary:{incoming:all.filter(x=>x.direction==="in").reduce((s,x)=>s+n(x.amount),0),outgoing:all.filter(x=>x.direction==="out").reduce((s,x)=>s+n(x.amount),0),net:all.reduce((s,x)=>s+(x.direction==="in"?n(x.amount):-n(x.amount)),0),operatingIncoming:operating.filter(x=>x.direction==="in").reduce((s,x)=>s+n(x.amount),0),operatingOutgoing:operating.filter(x=>x.direction==="out").reduce((s,x)=>s+n(x.amount),0),operatingNet:operating.reduce((s,x)=>s+(x.direction==="in"?n(x.amount):-n(x.amount)),0)},rows,meta:pagination(totalRows,f)};
  }
  if (f.type === "debts") { const query:Document={};if(f.search)query.$or=[{name:{$regex:f.search,$options:"i"}},{phone:{$regex:f.search}}];if(f.debtSide==="receivable")query.receivable={$gt:0};if(f.debtSide==="payable")query.payable={$gt:0};if(f.debtSide==="clear")query.$and=[{receivable:{$lte:0}},{payable:{$lte:0}}];const total=await db.collection("parties").countDocuments(query),all=await db.collection("parties").find(query).toArray(),raw=await pageCursor(db.collection("parties").find(query).sort({name:1}),f).toArray(),rows=raw.map(p=>({id:String(p.id),partyId:String(p.id),name:String(p.name),phone:String(p.phone??""),partyType:String(p.partyType),accountType:p.partyType==="customer"?"عميل":"مورد",balance:p.partyType==="customer"?n(p.receivable):n(p.payable),receivable:p.partyType==="customer"?n(p.receivable):0,payable:p.partyType==="supplier"?n(p.payable):0,lastMovement:String(p.lastMovementAt??"")}));return{report:f.type,from:null,to:null,summary:{receivable:all.filter(p=>p.partyType==="customer").reduce((s,p)=>s+n(p.receivable),0),payable:all.filter(p=>p.partyType==="supplier").reduce((s,p)=>s+n(p.payable),0)},rows,meta:pagination(total,f)}; }
  if (f.type === "party-ledger") { if(!f.partyId)throw new Error("يجب اختيار الطرف");const party=await db.collection("parties").findOne({id:f.partyId});if(!party)throw new Error("الطرف غير موجود");const query={partyId:f.partyId,status:"posted",kind:{$in:["sale","purchase","return","payment","offset","settlement"]},...matchDate(f)},total=await db.collection("documents").countDocuments(query),raw=await pageCursor(db.collection("documents").find(query).sort({occurredAt:-1}),f).toArray(),rows=raw.map(d=>{let debit=0,credit=0;if(d.kind==="sale")debit=n(d.dueTotal);else if(d.kind==="purchase")credit=n(d.dueTotal);else if(d.kind==="return")credit=Math.max(0,n(d.total)-n(d.paidTotal));else if(d.kind==="payment"||d.kind==="settlement"){if(String(d.title).includes("دفع لنا"))credit=n(d.total);else debit=n(d.total)}else if(d.kind==="offset"){debit=n(d.total);credit=n(d.total)}return{id:String(d.id),documentId:String(d.id),occurredAt:String(d.occurredAt),movementType:String(d.kind),documentNumber:displayDocumentNumber(d),description:String(d.title??d.partyName??""),debit,credit,paymentMethod:String(d.paymentMethod??"")}});return{report:f.type,from:f.from!,to:f.to!,summary:{name:String(party.name),receivable:n(party.receivable),payable:n(party.payable),net:n(party.receivable)-n(party.payable)},rows,meta:pagination(total,f)}; }
  const documents=await db.collection("documents").find({kind:{$in:["sale","return"]},status:"posted",...matchDate(f),...(f.productId?{"lines.productId":f.productId}:{})}).toArray(),facts=await saleFacts(db,documents,f);
  if(f.type==="product-sales"){const map=new Map<string,ReportRow>();for(const fact of facts){const key=String(fact.productId),r=map.get(key)??{id:key,productId:key,sku:"",product:fact.product,soldQuantity:0,returnedQuantity:0,netQuantity:0,sales:0,returns:0,netSales:0,averagePrice:0,profit:0,costKnown:true};if(n(fact.quantity)>=0){r.soldQuantity=n(r.soldQuantity)+n(fact.quantity);r.sales=n(r.sales)+n(fact.revenue)}else{r.returnedQuantity=n(r.returnedQuantity)+Math.abs(n(fact.quantity));r.returns=n(r.returns)+Math.abs(n(fact.revenue))}r.netQuantity=n(r.netQuantity)+n(fact.quantity);r.netSales=n(r.netSales)+n(fact.revenue);r.averagePrice=n(r.soldQuantity)?n(r.sales)/n(r.soldQuantity):0;r.costKnown=Boolean(r.costKnown)&&Boolean(fact.costKnown);r.profit=n(r.profit)+n(fact.profit);map.set(key,r)}const products=await db.collection("products").find({id:{$in:[...map.keys()]}}).project({id:1,sku:1,name:1}).toArray();for(const p of products){const r=map.get(String(p.id));if(r){r.sku=String(p.sku??"—")||"—";r.product=String(p.name??r.product??"").trim()||"منتج غير متاح"}}const rows=[...map.values()];rows.sort((a,b)=>f.sortBy==="name"?String(a.product).localeCompare(String(b.product),"ar"):n(b[f.sortBy==="sales"?"netSales":f.sortBy==="profit"?"profit":"netQuantity"])-n(a[f.sortBy==="sales"?"netSales":f.sortBy==="profit"?"profit":"netQuantity"]));return{report:f.type,from:f.from!,to:f.to!,summary:{products:rows.length,quantity:rows.reduce((s,r)=>s+n(r.netQuantity),0),sales:rows.reduce((s,r)=>s+n(r.netSales),0),profit:rows.reduce((s,r)=>s+n(r.profit),0),unknownRevenue:facts.reduce((s,r)=>s+n(r.unknownRevenue),0)},rows:slice(rows,f),meta:pagination(rows.length,f)};}
  const grouped=new Map<string,ReportRow>();for(const fact of facts){const key=f.groupBy==="product"?String(fact.productId):String(fact.documentId),g=grouped.get(key)??{id:key,documentId:fact.documentId,number:fact.number,occurredAt:fact.occurredAt,productId:fact.productId,product:fact.product,sku:fact.sku,quantity:0,revenue:0,cost:0,profit:0,unknownRevenue:0,costKnown:true,invoiceIdList:""};g.quantity=n(g.quantity)+n(fact.quantity);g.revenue=n(g.revenue)+n(fact.revenue);g.cost=n(g.cost)+n(fact.cost);g.profit=n(g.profit)+n(fact.profit);g.unknownRevenue=n(g.unknownRevenue)+n(fact.unknownRevenue);g.costKnown=Boolean(g.costKnown)&&Boolean(fact.costKnown);const ids=new Set(String(g.invoiceIdList).split(",").filter(Boolean));ids.add(String(fact.documentId));g.invoiceIdList=[...ids].join(",");g.invoiceCount=ids.size;g.margin=n(g.revenue)?n(g.profit)/n(g.revenue)*100:0;grouped.set(key,g)}const prows=[...grouped.values()].map(row=>{const copy={...row};delete copy.invoiceIdList;return copy}).sort((a,b)=>n(b.profit)-n(a.profit));if(f.type==="profit")return{report:f.type,from:f.from!,to:f.to!,summary:{...profitSummary(facts),expiredInventoryLoss:expiryLoss},rows:slice(prows,f),meta:pagination(prows.length,f)};
  const commercial=await db.collection("documents").find({kind:{$in:["sale","return","purchase","expense"]},status:"posted",...matchDate(f)}).sort({occurredAt:-1}).toArray();
  const [financial,parties,accounts,products]=await Promise.all([db.collection("financialMovements").find({...matchDate(f)}).toArray(),db.collection("parties").find({partyType:{$in:["customer","supplier"]}}).sort({name:1}).toArray(),db.collection("paymentAccounts").find({isActive:{$ne:false}}).toArray(),db.collection("products").find({isArchived:{$ne:true}}).project({stocks:1,lastPurchaseCost:1,pieceCost:1}).toArray()]);
  const profitByDocument=new Map<string,number>();for(const fact of facts)profitByDocument.set(String(fact.documentId),(profitByDocument.get(String(fact.documentId))??0)+n(fact.profit));
  const invoices=commercial.filter(d=>["sale","purchase","expense","return"].includes(String(d.kind))).map(d=>({id:String(d.id),documentId:String(d.id),kind:String(d.kind),type:d.kind==="sale"?"فاتورة بيع":d.kind==="purchase"?"فاتورة شراء":d.kind==="expense"?"فاتورة مصروفات":"إرجاع بيع",number:displayDocumentNumber(d),occurredAt:String(d.occurredAt),profit:d.kind==="sale"?(profitByDocument.get(String(d.id))??0):null}));
  const partyRows=parties.map(p=>({id:String(p.id),partyId:String(p.id),name:String(p.name),partyType:String(p.partyType),receivable:p.partyType==="customer"?n(p.receivable):0,payable:p.partyType==="supplier"?n(p.payable):0}));
  const cash=accounts.find(a=>a.code==="cash"),cashIds=new Set([String(cash?.id??""),"cash"]),cashMovements=financial.filter(m=>cashIds.has(String(m.paymentMethod)));
  const p=profitSummary(facts),sales=commercial.filter(d=>d.kind==="sale").reduce((v,d)=>v+n(d.total),0)-commercial.filter(d=>d.kind==="return").reduce((v,d)=>v+n(d.total),0);
  return{report:"overview",from:f.from!,to:f.to!,summary:{sales,purchases:commercial.filter(d=>d.kind==="purchase").reduce((v,d)=>v+n(d.total),0),expenses:commercial.filter(d=>d.kind==="expense").reduce((v,d)=>v+n(d.total),0),profit:p.profit,cashIn:cashMovements.filter(m=>m.direction==="in").reduce((v,m)=>v+n(m.amount),0),cashOut:cashMovements.filter(m=>m.direction==="out").reduce((v,m)=>v+n(m.amount),0),cashBalance:n(cash?.balance),bankBalance:accounts.filter(a=>a.code!=="cash").reduce((v,a)=>v+n(a.balance),0),inventoryValue:products.reduce((v,product)=>v+Object.values((product.stocks??{}) as Record<string,unknown>).reduce<number>((q,value)=>q+n(value),0)*(Number.isFinite(product.lastPurchaseCost)?n(product.lastPurchaseCost):Number.isFinite(product.pieceCost)?n(product.pieceCost):0),0),customerReceivables:parties.filter(p=>p.partyType==="customer").reduce((v,p)=>v+n(p.receivable),0),supplierPayables:parties.filter(p=>p.partyType==="supplier").reduce((v,p)=>v+n(p.payable),0),customerCount:parties.filter(p=>p.partyType==="customer").length,supplierCount:parties.filter(p=>p.partyType==="supplier").length},rows:[],invoices,parties:partyRows,meta:pagination(invoices.length,f)};

}
