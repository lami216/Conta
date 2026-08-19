import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { execute } from "../app/api/command/route.ts";

let replica, client, db, unavailable;
before(async () => {
  try {
    replica = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
    client = new MongoClient(replica.getUri()); await client.connect(); db = client.db("conta_integration_test");
    assert.match(db.databaseName, /test/, "integration tests must never target production");
  } catch (error) { unavailable = `MongoDB test binary unavailable: ${error.message}`; }
});
after(async () => { await client?.close(); await replica?.stop(); });
beforeEach(async () => {
  if (unavailable) return;
  await db.dropDatabase();
  await db.collection("warehouses").insertMany([{ _id: "wh-main", name: "Main" }, { _id: "wh-b", name: "B" }]);
  await db.collection("products").insertOne({ id: "p1", name: "Tea", sku: "TEA", barcode: "", pieceCost: 50, piecePrice: 100, cartonPrice: 1000, piecesPerCarton: 12, stocks: {} });
  await db.collection("parties").insertOne({ id: "party", name: "Party", phone: "", receivable: 0, payable: 0, net: 0 });
});
async function command(body) {
  let result;
  await client.withSession(s => s.withTransaction(async () => { result = await execute(db, s, body); }));
  return result;
}

test("first purchase initializes missing stock, movement, and supplier payable atomically", async t => {
  if (unavailable) return t.skip(unavailable);
  await command({ type: "purchase.post", warehouseId: "wh-main", partyId: "party", paymentMethod: "note", paidAmount: 500, lines: [{ productId: "p1", quantity: 50, unitPrice: 50 }] });
  assert.equal((await db.collection("products").findOne({ id: "p1" })).stocks["wh-main"], 50);
  assert.deepEqual(await db.collection("stockMovements").findOne({}, { projection: { _id: 0, balanceBefore: 1, balanceAfter: 1, quantityDelta: 1 } }), { quantityDelta: 50, balanceBefore: 0, balanceAfter: 50 });
  const doc = await db.collection("documents").findOne({ kind: "purchase" });
  assert.deepEqual([doc.total, doc.paidTotal, doc.dueTotal], [2500, 500, 2000]);
  assert.deepEqual(await db.collection("parties").findOne({ id: "party" }, { projection: { _id: 0, payable: 1, net: 1 } }), { payable: 2000, net: -2000 });
});

test("sale decreases stock and insufficient sale rolls every write back", async t => {
  if (unavailable) return t.skip(unavailable);
  await db.collection("products").updateOne({ id: "p1" }, { $set: { "stocks.wh-main": 100 } });
  await command({ type: "sale.post", warehouseId: "wh-main", partyId: "party", paymentMethod: "note", paidAmount: 700, lines: [{ productId: "p1", quantity: 27, piecePrice: 100, cartonPrice: 1000, pricingMode: "piece" }] });
  assert.equal((await db.collection("products").findOne({ id: "p1" })).stocks["wh-main"], 73);
  const beforeCounts = [await db.collection("documents").countDocuments(), await db.collection("stockMovements").countDocuments()];
  await assert.rejects(command({ type: "sale.post", warehouseId: "wh-main", partyId: "party", paymentMethod: "note", paidAmount: 0, lines: [{ productId: "p1", quantity: 74, piecePrice: 100, cartonPrice: 1000, pricingMode: "piece" }] }), /المخزون غير كاف/);
  assert.equal((await db.collection("products").findOne({ id: "p1" })).stocks["wh-main"], 73);
  assert.deepEqual([await db.collection("documents").countDocuments(), await db.collection("stockMovements").countDocuments()], beforeCounts);
  assert.equal((await db.collection("parties").findOne({ id: "party" })).receivable, 2000);
});

test("transfer and adjustment initialize missing destination fields", async t => {
  if (unavailable) return t.skip(unavailable);
  await db.collection("products").updateOne({ id: "p1" }, { $set: { "stocks.wh-main": 30 } });
  await command({ type: "transfer.post", fromWarehouseId: "wh-main", toWarehouseId: "wh-b", lines: [{ productId: "p1", quantity: 10 }] });
  let product = await db.collection("products").findOne({ id: "p1" }); assert.deepEqual(product.stocks, { "wh-main": 20, "wh-b": 10 });
  await db.collection("products").updateOne({ id: "p1" }, { $unset: { "stocks.wh-b": "" } });
  await command({ type: "adjustment.post", warehouseId: "wh-b", reason: "count", lines: [{ productId: "p1", actualQuantity: 17 }] });
  product = await db.collection("products").findOne({ id: "p1" }); assert.equal(product.stocks["wh-b"], 17);
  assert.deepEqual(await db.collection("stockMovements").findOne({ type: "adjustment" }, { projection: { _id: 0, balanceBefore: 1, balanceAfter: 1, quantityDelta: 1 } }), { quantityDelta: 17, balanceBefore: 0, balanceAfter: 17 });
});

test("partial returns accumulate only up to sold quantity", async t => {
  if (unavailable) return t.skip(unavailable);
  await db.collection("products").updateOne({ id: "p1" }, { $set: { "stocks.wh-main": 5 } });
  const saleId = await command({ type: "sale.post", warehouseId: "wh-main", partyId: "party", paymentMethod: "cash", paidAmount: 500, lines: [{ productId: "p1", quantity: 5, piecePrice: 100, cartonPrice: 1000, pricingMode: "piece" }] });
  await command({ type: "sale.return", saleId, lines: [{ productId: "p1", quantity: 2 }] });
  await command({ type: "sale.return", saleId, lines: [{ productId: "p1", quantity: 3 }] });
  await assert.rejects(command({ type: "sale.return", saleId, lines: [{ productId: "p1", quantity: 1 }] }), /تتجاوز/);
  assert.equal((await db.collection("products").findOne({ id: "p1" })).stocks["wh-main"], 5);
});

test("payments, offset, settlement, expense and invalid input preserve balance invariant", async t => {
  if (unavailable) return t.skip(unavailable);
  await db.collection("parties").updateOne({ id: "party" }, { $set: { receivable: 10000, payable: 7000, net: 3000 } });
  await command({ type: "offset.post", partyId: "party", amount: 7000 });
  await command({ type: "payment.post", partyId: "party", side: "receivable", amount: 1000 });
  await command({ type: "settlement.post", partyId: "party", side: "receivable", amount: 500 });
  const party = await db.collection("parties").findOne({ id: "party" }); assert.deepEqual([party.receivable, party.payable, party.net], [1500, 0, 1500]);
  await command({ type: "expense.post", title: "Rent", amount: 100, occurredAt: "2026-08-15" });
  assert.equal(await db.collection("documents").countDocuments({ kind: "expense" }), 1);
  const count = await db.collection("documents").countDocuments();
  await assert.rejects(command({ type: "purchase.post", warehouseId: "unknown", partyId: "party", lines: [{ productId: "p1", quantity: -1, unitPrice: 1 }] }));
  assert.equal(await db.collection("documents").countDocuments(), count);
});

test("product codes are atomic, sequential, unique, and independent from barcodes", async t => {
  if (unavailable) return t.skip(unavailable);
  await db.collection("products").createIndex({ sku: 1 }, { unique: true });
  await db.collection("products").insertOne({ id: "legacy", name: "Legacy", sku: "9", barcode: "14313143", stocks: {} });
  const firstId = await command({ type: "product.create", name: "Product A" });
  const secondId = await command({ type: "product.create", name: "Product B" });
  const [first, second] = await Promise.all([
    db.collection("products").findOne({ id: firstId }),
    db.collection("products").findOne({ id: secondId }),
  ]);
  assert.deepEqual([first.sku, second.sku], ["10", "11"]);
  assert.deepEqual([first.barcode, first.pieceCost, first.piecePrice, first.piecesPerCarton], ["", null, null, null]);
  await assert.rejects(db.collection("products").insertOne({ id: "duplicate", name: "Duplicate", sku: "11", stocks: {} }), /duplicate key/i);
});
