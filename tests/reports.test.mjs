import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { buildReport, parseReportFilters } from "../lib/reports.ts";
const parse = query => parseReportFilters(new URL(`http://localhost/api/reports?${query}`));
let server, client, db;
before(async()=>{server=await MongoMemoryServer.create();client=new MongoClient(server.getUri());await client.connect();db=client.db("reports");});
after(async()=>{await client?.close();await server?.stop();});
const filters=(type,extra={})=>({type,from:"2026-08-01",to:"2026-08-31",page:1,pageSize:100,...extra});
const line=(id,productId,quantity,unitPrice,costAtSale)=>({id,productId,description:productId,quantity,unitPrice,lineTotal:quantity*unitPrice,...(costAtSale===undefined?{}:{costAtSale})});
const doc=(id,kind,date,lines,extra={})=>({id,number:`N-${id}`,kind,status:"posted",occurredAt:`${date}T12:00:00.000Z`,total:lines.reduce((s,l)=>s+l.lineTotal,0),paidTotal:0,dueTotal:0,lines,...extra});
test("report periods and strict paging/group allowlists",()=>{const value=parse("type=sales&from=2026-08-01&to=2026-08-21&page=2&pageSize=100");assert.deepEqual([value.from,value.to,value.page,value.pageSize],["2026-08-01","2026-08-21",2,100]);assert.throws(()=>parse("type=sales&from=2026-08-22&to=2026-08-21"),/بداية الفترة/);assert.throws(()=>parse("type=tax&from=2026-08-01&to=2026-08-21"),/نوع التقرير/);assert.throws(()=>parse("type=profit&from=2026-08-01&to=2026-08-21&groupBy=party"),/groupBy/);});
test("snapshot profit, returns, and current product cost independence",async()=>{await db.dropDatabase();await db.collection("products").insertOne({id:"a",lastPurchaseCost:999});await db.collection("documents").insertMany([doc("sale","sale","2026-08-10",[line("s","a",10,100,70)]),doc("ret","return","2026-08-11",[line("r","a",2,100,70)],{parentDocumentId:"sale"})]);const report=await buildReport(db,filters("profit"));assert.equal(report.summary.revenue,800);assert.equal(report.summary.cost,560);assert.equal(report.summary.profit,240);});
test("legacy cost uses latest purchase before sale, never a later purchase",async()=>{await db.dropDatabase();await db.collection("documents").insertMany([doc("p1","purchase","2026-08-01",[line("p1l","a",1,60)]),doc("p2","purchase","2026-08-05",[line("p2l","a",1,70)]),doc("s","sale","2026-08-10",[line("sl","a",10,100)]),doc("p3","purchase","2026-08-20",[line("p3l","a",1,500)])]);const report=await buildReport(db,filters("profit"));assert.equal(report.summary.cost,700);assert.equal(report.summary.profit,300);assert.equal((await db.collection("documents").findOne({id:"s"})).lines[0].costAtSale,undefined);});
test("unknown legacy cost is calculated as zero while provenance stays unknown",async()=>{await db.dropDatabase();await db.collection("documents").insertOne(doc("s","sale","2026-08-10",[line("sl","a",2,11000)]));const report=await buildReport(db,filters("profit"));assert.equal(report.summary.unknownRevenue,22000);assert.equal(report.summary.cost,0);assert.equal(report.summary.profit,22000);assert.equal(report.rows[0].costKnown,false);assert.equal(report.rows[0].cost,0);assert.equal(report.rows[0].profit,22000);assert.equal(report.rows[0].margin,100);});
test("summary includes known and unknown cost sales without null financial values",async()=>{await db.dropDatabase();await db.collection("documents").insertMany([doc("known","sale","2026-08-10",[line("kl","a",1,20000,14500)]),doc("unknown","sale","2026-08-11",[line("ul","b",1,22000)])]);const report=await buildReport(db,filters("sales"));assert.deepEqual([report.summary.netSales,report.summary.cost,report.summary.profit],[42000,14500,27500]);for(const row of report.rows)for(const key of ["cost","profit","margin"])assert.equal(Number.isFinite(row[key]),true,`${key} must be finite`);});
test("product filters use only selected lines in sales, purchases, returns, and profit",async()=>{await db.dropDatabase();await db.collection("documents").insertMany([doc("s","sale","2026-08-10",[line("a","a",10,100,70),line("b","b",1,5000,100)]),doc("p","purchase","2026-08-10",[line("pa","a",3,50),line("pb","b",1,900)]),doc("r","return","2026-08-11",[line("ra","a",2,100,70),line("rb","b",1,5000,100)],{parentDocumentId:"s"})]);const sales=await buildReport(db,filters("sales",{productId:"a"})),purchases=await buildReport(db,filters("purchases",{productId:"a"})),returns=await buildReport(db,filters("returns",{productId:"a"})),profit=await buildReport(db,filters("profit",{productId:"a"}));assert.equal(sales.summary.netSales,800);assert.equal(sales.summary.profit,240);assert.equal(purchases.summary.total,150);assert.equal(returns.summary.total,200);assert.equal(profit.summary.revenue,800);assert.equal(profit.rows.some(row=>row.productId==="b"),false);});
test("product profit invoiceCount is unique per document",async()=>{await db.dropDatabase();await db.collection("documents").insertMany([doc("s1","sale","2026-08-10",[line("1","a",1,100,70),line("2","a",2,100,70)]),doc("s2","sale","2026-08-11",[line("3","a",1,100,70)])]);const report=await buildReport(db,filters("profit",{groupBy:"product"}));assert.equal(report.rows[0].invoiceCount,2);});
test("financial transfers are excluded from operating totals",async()=>{await db.dropDatabase();await db.collection("financialMovements").insertMany([{id:"1",occurredAt:"2026-08-10T12:00:00Z",type:"sale",direction:"in",amount:100},{id:"2",occurredAt:"2026-08-10T12:00:00Z",type:"transfer-in",direction:"in",amount:500},{id:"3",occurredAt:"2026-08-10T12:00:00Z",type:"transfer-out",direction:"out",amount:500}]);const report=await buildReport(db,filters("financial"));assert.equal(report.summary.incoming,600);assert.equal(report.summary.operatingIncoming,100);assert.equal(report.summary.operatingNet,100);});
test("overview uses authoritative typed balances and cash movement",async()=>{await db.dropDatabase();await db.collection("paymentAccounts").insertOne({id:"cash-id",code:"cash",balance:205,isActive:true});await db.collection("parties").insertMany([{id:"c",name:"C",partyType:"customer",receivable:300,payable:99},{id:"s",name:"S",partyType:"supplier",payable:300,receivable:88}]);await db.collection("financialMovements").insertMany(Array.from({length:205},(_,i)=>({id:String(i),paymentMethod:"cash-id",occurredAt:`2026-08-${String(1+i%20).padStart(2,"0")}T12:00:00Z`,type:"sale",direction:"in",amount:1})));const report=await buildReport(db,filters("overview"));assert.equal(report.summary.cashIn,205);assert.equal(report.summary.customerReceivables,300);assert.equal(report.summary.supplierPayables,300);assert.deepEqual([report.summary.customerCount,report.summary.supplierCount],[1,1]);});
test("return report resolves original invoice number",async()=>{await db.dropDatabase();await db.collection("documents").insertMany([doc("internal-sale","sale","2026-08-10",[line("s","a",1,100,70)]),doc("return","return","2026-08-11",[line("r","a",1,100,70)],{parentDocumentId:"internal-sale"})]);const report=await buildReport(db,filters("returns"));assert.equal(report.rows[0].originalDocument,"N-internal-sale");assert.notEqual(report.rows[0].originalDocument,"internal-sale");});
test("allTime ignores dates, keeps full summary across pages, and normal range remains bounded",async()=>{await db.dropDatabase();await db.collection("documents").insertMany([doc("old","sale","2020-01-01",[line("o","a",1,100,70)]),doc("new","sale","2026-08-10",[line("n","a",2,100,70)])]);const all=await buildReport(db,{type:"sales",allTime:true,page:1,pageSize:1}),dated=await buildReport(db,filters("sales",{pageSize:1}));assert.equal(all.meta.totalRows,2);assert.equal(all.rows.length,1);assert.equal(all.summary.netSales,300);assert.equal(dated.meta.totalRows,1);assert.equal(dated.summary.netSales,200);assert.equal(parse("type=sales&allTime=true&page=1&pageSize=100").allTime,true);});

test("current product identity fills blank legacy names across product, profit, stock, and purchase reports",async()=>{await db.dropDatabase();await db.collection("products").insertOne({id:"a",name:"الاسم الحالي",sku:"SKU-A"});const blank=line("s","a",1,100,70);blank.description="";await db.collection("documents").insertMany([doc("sale","sale","2026-08-10",[blank]),doc("purchase","purchase","2026-08-10",[{...blank,id:"p",unitPrice:50,lineTotal:50}])]);await db.collection("stockMovements").insertOne({id:"m",documentId:"sale",occurredAt:"2026-08-10T12:00:00Z",productId:"a",productName:"",warehouseName:"Main",type:"sale",balanceBefore:2,quantityDelta:-1,balanceAfter:1,documentNumber:"N-sale"});for(const report of [await buildReport(db,filters("product-sales")),await buildReport(db,filters("profit",{groupBy:"product"})),await buildReport(db,filters("stock")),await buildReport(db,filters("purchases",{productId:"a"}))]){assert.equal(report.rows[0].product,"الاسم الحالي");assert.equal(report.rows[0].sku,"SKU-A");}});

import { reportDateQuery, reportSummaryTone, reportTableModel } from "../app/report-types.ts";

test("report date and all-time requests remain distinct", () => {
  assert.deepEqual(reportDateQuery(false, "2026-08-01", "2026-08-22"), { from: "2026-08-01", to: "2026-08-22" });
  assert.deepEqual(reportDateQuery(true, "2026-08-01", "2026-08-22"), { allTime: "true" });
});

test("report summary tones follow financial meaning rather than numeric sign alone", () => {
  assert.equal(reportSummaryTone("profit", "profit", 20), "positive");
  assert.equal(reportSummaryTone("profit", "profit", -20), "negative");
  assert.equal(reportSummaryTone("debts", "receivable", 20), "negative");
  assert.equal(reportSummaryTone("party-ledger", "payable", 20), "negative");
  assert.equal(reportSummaryTone("financial", "net", 20), "positive");
  assert.equal(reportSummaryTone("financial", "net", -20), "negative");
  assert.equal(reportSummaryTone("purchases", "total", 20), "neutral");
});


test("report table retains known headers before a result exists", () => {
  const columns = [["number", "الفاتورة"], ["total", "الإجمالي"]];
  assert.deepEqual(reportTableModel(columns, null), { columns, rows: [] });
});

test("unpaged report returns every matching row while retaining full summary", async()=>{
  await db.dropDatabase();
  await db.collection("documents").insertMany(Array.from({length:245},(_,i)=>doc(String(i),"sale","2026-08-10",[line(String(i),"a",1,10,4)])));
  const report=await buildReport(db,filters("sales",{unpaged:true,pageSize:1}));
  assert.equal(report.meta.totalRows,245); assert.equal(report.rows.length,245); assert.equal(report.summary.netSales,2450);
  assert.equal(parse("type=sales&from=2026-08-01&to=2026-08-31&unpaged=true").unpaged,true);
});

test("purchase summary exposes total paid and due and expiry loss is non-cash stock valuation",async()=>{
  await db.dropDatabase();
  await db.collection("documents").insertMany([doc("p1","purchase","2026-08-10",[line("l1","a",2,50)],{paidTotal:40,dueTotal:60}),doc("p2","purchase","2026-08-11",[line("l2","a",1,70)],{paidTotal:70,dueTotal:0})]);
  const purchase=await buildReport(db,filters("purchases",{unpaged:true})); assert.deepEqual([purchase.summary.total,purchase.summary.paid,purchase.summary.due],[170,110,60]);
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10); await db.collection("products").insertOne({id:"a",name:"A",expiryDate:yesterday,lastPurchaseCost:12,pieceCost:3,stocks:{one:4,two:1}});
  const before=await db.collection("financialMovements").countDocuments(); const stock=await buildReport(db,filters("stock",{unpaged:true}));
  assert.equal(stock.summary.expiredInventoryLoss,60); assert.equal(await db.collection("financialMovements").countDocuments(),before); assert.equal((await db.collection("products").findOne({id:"a"})).stocks.one,4);
});
