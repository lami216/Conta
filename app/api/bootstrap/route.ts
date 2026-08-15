import { getMongo } from "../../../lib/mongodb";
import { log } from "../../../lib/log";

export async function GET() {
  try {
    const db = await getMongo();
    const [parties, warehouses, products, documents, movements, recurringExpenses] = await Promise.all([
      db.collection("parties").find().sort({ name: 1 }).toArray(), db.collection("warehouses").find().sort({ isSalesDefault: -1, name: 1 }).toArray(),
      db.collection("products").find().sort({ name: 1 }).toArray(), db.collection("documents").find().sort({ occurredAt: -1 }).limit(500).toArray(),
      db.collection("stockMovements").find().sort({ occurredAt: -1 }).limit(1000).toArray(), db.collection("recurringExpenses").find().sort({ createdAt: -1 }).toArray(),
    ]);
    return Response.json({ parties, warehouses, products, documents, movements, recurringExpenses });
  } catch (error) { log("error", "api.bootstrap.failed", { error }); return Response.json({ error: "تعذر تحميل البيانات" }, { status: 500 }); }
}
