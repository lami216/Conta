import { MongoClient, type Db } from "mongodb";
import { log } from "./log";

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
        database.collection("products").createIndex({ sku: 1 }, { unique: true }),
        database.collection("products").createIndex({ barcode: 1 }, { sparse: true }),
        database.collection("documents").createIndex({ number: 1 }, { unique: true }),
        database.collection("documents").createIndex({ partyId: 1, occurredAt: -1 }),
        database.collection("stockMovements").createIndex({ warehouseId: 1, productId: 1, occurredAt: -1 }),
        database.collection("auditEvents").createIndex({ createdAt: -1 }),
      ]);
      const warehouses = database.collection<{ _id: string; name: string; isSalesDefault: boolean; createdAt: Date }>("warehouses");
      await warehouses.updateOne({ _id: "wh-main" }, { $setOnInsert: { name: "المخزن الرئيسي", isSalesDefault: false, createdAt: new Date() } }, { upsert: true });
      await warehouses.updateOne({ _id: "wh-boutique" }, { $setOnInsert: { name: "البوتيك", isSalesDefault: true, createdAt: new Date() } }, { upsert: true });
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
