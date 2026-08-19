import { MongoClient, type Db } from "mongodb";
import { log } from "./log.ts";

let client: MongoClient | undefined;
let database: Db | undefined;
let initialization: Promise<Db> | undefined;

export function initializeMongo(): Promise<Db> {
  return initialization ??= (async () => {
    log("info", "mongodb.initialization.started");
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is required");
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
    try {
      await client.connect();
      database = client.db(process.env.MONGODB_DB || "conta");
      await database.command({ ping: 1 });
      await Promise.all([
        database.collection("parties").createIndex({ name: 1 }),
        database.collection("parties").createIndex({ id: 1 }, { unique: true }),
        database.collection("parties").createIndex({ phone: 1 }),
        database.collection("products").createIndex({ id: 1 }, { unique: true }),
        database.collection("products").createIndex({ sku: 1 }, { unique: true }),
        database.collection("products").createIndex({ barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: "string", $gt: "" } }, name: "barcode_unique_nonempty" }),
        database.collection("documents").createIndex({ id: 1 }, { unique: true }),
        database.collection("documents").createIndex({ number: 1 }, { unique: true }),
        database.collection("documents").createIndex({ partyId: 1, occurredAt: -1 }),
        database.collection("documents").createIndex({ kind: 1, occurredAt: -1 }),
        database.collection("stockMovements").createIndex({ warehouseId: 1, productId: 1, occurredAt: -1 }),
        database.collection("auditEvents").createIndex({ createdAt: -1 }),
        database.collection("financialMovements").createIndex({ documentId: 1, type: 1 }, { unique: true }),
        database.collection("financialMovements").createIndex({ paymentMethod: 1, occurredAt: -1 }),
        database.collection("paymentAccounts").createIndex({ id: 1 }, { unique: true }),
        database.collection("paymentAccounts").createIndex({ code: 1 }, { unique: true }),
        database.collection("documents").createIndex({ recurringId: 1, occurrenceKey: 1 }, { unique: true, partialFilterExpression: { recurringId: { $type: "string" }, occurrenceKey: { $type: "string" } }, name: "recurring_occurrence_unique" }),
      ]);
      const warehouses = database.collection<{ _id: string; name: string; isSalesDefault: boolean; createdAt: Date }>("warehouses");
      await warehouses.updateOne({ _id: "wh-main" }, { $setOnInsert: { name: "المخزن الرئيسي", isSalesDefault: false, createdAt: new Date() } }, { upsert: true });
      await warehouses.updateOne({ _id: "wh-boutique" }, { $setOnInsert: { name: "البوتيك", isSalesDefault: true, createdAt: new Date() } }, { upsert: true });
      const accounts = database.collection("paymentAccounts");
      const defaults = [
        ["cash", "نقدي", "#16835f", "banknote"], ["bankily", "بنكيلي", "#1677c8", "wallet"],
        ["masrvi", "مصرفي", "#6d55c7", "building"], ["sedad", "السداد", "#d07a20", "landmark"],
        ["bimbank", "بيم", "#c14666", "card"],
      ];
      await Promise.all(defaults.map(([code, name, color, icon]) => accounts.updateOne(
        { code }, { $setOnInsert: { id: `account-${code}`, code, name, color, icon, isActive: true, balance: 0, createdAt: new Date() } }, { upsert: true },
      )));
      const legacyBalances = await database.collection("financialMovements").aggregate([
        { $group: { _id: "$paymentMethod", balance: { $sum: { $cond: [{ $eq: ["$direction", "in"] }, "$amount", { $multiply: ["$amount", -1] }] } } } },
      ]).toArray();
      await Promise.all(defaults.map(([code]) => accounts.updateOne(
        { code, balanceInitialized: { $ne: true } },
        { $set: { balance: Number(legacyBalances.find(row => row._id === code || row._id === `account-${code}`)?.balance ?? 0), balanceInitialized: true } },
      )));
      log("info", "mongodb.initialization.completed");
      return database;
    } catch (error) {
      log("error", "mongodb.initialization.failed", { error });
      await client.close().catch(() => undefined);
      client = undefined;
      database = undefined;
      initialization = undefined;
      throw error;
    }
  })();
}

export async function getMongo() { return database ?? initializeMongo(); }
export function getMongoClient() {
  if (!client) throw new Error("MongoDB is not initialized");
  return client;
}
