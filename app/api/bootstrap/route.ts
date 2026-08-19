import { getMongo } from "../../../lib/mongodb";
import { log } from "../../../lib/log";
import { sessionFromRequest } from "../../../lib/auth";

export async function GET(request: Request) {
  if (!sessionFromRequest(request)) return Response.json({ error: "غير مصرح" }, { status: 401 });
  try {
    const db = await getMongo();
    await db.collection("documents").createIndex(
      { kind: 1, businessDate: 1, dailySequence: 1 },
      { unique: true, partialFilterExpression: { kind: "sale", businessDate: { $type: "string" }, dailySequence: { $type: "number" } } },
    );
    // One-time, idempotent legacy backfill. The sorted unwind makes the first line
    // for each product the newest real posted purchase price.
    const legacyCosts = await db.collection("documents").aggregate([
      { $match: { kind: "purchase", status: "posted" } }, { $sort: { occurredAt: -1 } },
      { $unwind: "$lines" }, { $match: { "lines.productId": { $type: "string" } } },
      { $group: { _id: "$lines.productId", cost: { $first: "$lines.unitPrice" }, at: { $first: "$occurredAt" } } },
    ]).toArray();
    if (legacyCosts.length) await db.collection("products").bulkWrite(legacyCosts.map(cost => ({
      updateOne: { filter: { id: cost._id, lastPurchaseCost: { $exists: false } }, update: { $set: { lastPurchaseCost: cost.cost, lastPurchaseAt: cost.at } } },
    })));
    const [parties, warehouses, products, documents, movements, recurringExpenses, financialMovements, paymentAccounts, accountTransfers] = await Promise.all([
      db.collection("parties").find().sort({ name: 1 }).toArray(), db.collection("warehouses").find().sort({ isSalesDefault: -1, name: 1 }).toArray(),
      db.collection("products").find().sort({ name: 1 }).toArray(), db.collection("documents").find().sort({ occurredAt: -1 }).limit(500).toArray(),
      db.collection("stockMovements").find().sort({ occurredAt: -1 }).limit(1000).toArray(), db.collection("recurringExpenses").find().sort({ createdAt: -1 }).toArray(),
      db.collection("financialMovements").find().sort({ occurredAt: -1 }).limit(2000).toArray(),
      db.collection("paymentAccounts").find().sort({ createdAt: 1 }).toArray(),
      db.collection("accountTransfers").find().sort({ occurredAt: -1 }).limit(500).toArray(),
    ]);
    const clean = (rows: Array<Record<string, unknown>>) => rows.map(({ _id, ...row }) => ({ id: row.id ?? String(_id), ...row }));
    const accountRows = paymentAccounts.map(account => {
      const related = financialMovements.filter(m => m.paymentMethod === account.id || m.paymentMethod === account.code);
      return { ...account, id: String(account.id), balance: Number(account.balance ?? 0), income: related.filter(m => m.direction === "in").reduce((s, m) => s + Number(m.amount), 0), expenses: related.filter(m => m.direction === "out").reduce((s, m) => s + Number(m.amount), 0) };
    });
    const today = new Date().toISOString().slice(0, 10);
    const recurringRows = recurringExpenses.map(recurring => { const occurrenceKey = recurring.frequency === "monthly" ? today.slice(0, 7) : today; const paid = documents.find(d => d.recurringId === recurring.id && (d.occurrenceKey === occurrenceKey || d.dueDate === today)); return { ...recurring, currentOccurrenceKey: occurrenceKey, currentDueDate: today, currentPaymentMethodId: paid?.paymentMethod ?? null }; });
    return Response.json({ parties: clean(parties), warehouses: clean(warehouses), products: clean(products), documents: clean(documents), movements: clean(movements), recurringExpenses: clean(recurringRows), financialMovements: clean(financialMovements), paymentAccounts: clean(accountRows), accountTransfers: clean(accountTransfers) });
  } catch (error) { log("error", "api.bootstrap.failed", { error }); return Response.json({ error: "تعذر تحميل البيانات" }, { status: 500 }); }
}
