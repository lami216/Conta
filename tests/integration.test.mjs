import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

test("runs the auditable multi-warehouse accounting scenario", async (t) => {
  const testDir = await mkdtemp(join(tmpdir(), "conta-worker-"));
  t.after(() => rm(testDir, { recursive: true, force: true }));
  const workerBundle = join(testDir, "operations.mjs");
  await build({
    entryPoints: ["worker/index.ts"],
    outfile: workerBundle,
    bundle: true,
    platform: "node",
    format: "esm",
    treeShaking: true,
    plugins: [
      {
        name: "vinext-test-stubs",
        setup(builder) {
          builder.onResolve({ filter: /^vinext\/server\// }, (args) => ({
            path: args.path,
            namespace: "vinext-stub",
          }));
          builder.onLoad(
            { filter: /image-optimization$/, namespace: "vinext-stub" },
            () => ({
              contents:
                "export const DEFAULT_DEVICE_SIZES=[]; export const DEFAULT_IMAGE_SIZES=[]; export async function handleImageOptimization(){return new Response();}",
            }),
          );
          builder.onLoad(
            { filter: /app-router-entry$/, namespace: "vinext-stub" },
            () => ({
              contents: "export default {fetch(){return new Response();}};",
            }),
          );
        },
      },
    ],
  });
  const operations = await import(pathToFileURL(workerBundle).href);
  const mf = new Miniflare({
    compatibilityDate: "2025-04-01",
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
    d1Databases: ["DB"],
  });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  await db.exec(await readFile("db/schema.sql", "utf8"));

  const command = async (body, expectedStatus = 200) => {
    try {
      const result = await operations.command(db, body);
      assert.equal(expectedStatus, 200, "the operation unexpectedly succeeded");
      return { id: result };
    } catch (error) {
      if (expectedStatus === 400) return { error };
      throw error;
    }
  };
  const state = () => operations.bootstrap(db);

  const party = (
    await command({
      type: "party.create",
      name: "طرف الاختبار",
      phone: "22 33 44 55",
    })
  ).id;
  const third = (
    await command({ type: "warehouse.create", name: "المخزن الثالث" })
  ).id;
  await command({
    type: "warehouse.update",
    id: third,
    name: "المخزن الثالث المعدل",
  });
  await command({ type: "warehouse.default", warehouseId: "wh-boutique" });
  const rice = (
    await command({
      type: "product.create",
      name: "أرز اختبار",
      sku: `R-${Date.now()}`,
      pieceCost: 100,
      piecePrice: 150,
      cartonPrice: 1400,
      piecesPerCarton: 10,
    })
  ).id;
  const oil = (
    await command({
      type: "product.create",
      name: "زيت اختبار",
      sku: `O-${Date.now()}`,
      pieceCost: 200,
      piecePrice: 280,
      cartonPrice: 3200,
      piecesPerCarton: 12,
    })
  ).id;
  await command(
    {
      type: "product.update",
      id: rice,
      name: "أرز اختبار معدل",
      pieceCost: 110,
      piecePrice: 150,
      cartonPrice: 1400,
      piecesPerCarton: 10,
      barcode: "",
    },
    400,
  );
  await command({
    type: "product.update",
    id: rice,
    name: "أرز اختبار معدل",
    pieceCost: 110,
    piecePrice: 150,
    cartonPrice: 1400,
    piecesPerCarton: 10,
    barcode: "",
    confirmSensitive: true,
  });

  const purchase = (
    await command({
      type: "purchase.post",
      partyId: party,
      warehouseId: third,
      paymentMethod: "note",
      lines: [
        { productId: rice, quantity: 100, unitPrice: 100 },
        { productId: oil, quantity: 36, unitPrice: 200 },
      ],
    })
  ).id;
  let snapshot = await state();
  assert.equal(snapshot.products.find((p) => p.id === rice).stocks[third], 100);
  assert.equal(snapshot.products.find((p) => p.id === oil).stocks[third], 36);

  const transfer = (
    await command({
      type: "transfer.post",
      fromWarehouseId: third,
      toWarehouseId: "wh-boutique",
      lines: [
        { productId: rice, quantity: 50 },
        { productId: oil, quantity: 24 },
      ],
    })
  ).id;
  const cashSale = (
    await command({
      type: "sale.post",
      warehouseId: "wh-boutique",
      paymentMethod: "cash",
      lines: [
        { productId: rice, quantity: 12, piecePrice: 150, cartonPrice: 1400 },
      ],
    })
  ).id;
  const noteSale = (
    await command({
      type: "sale.post",
      warehouseId: "wh-boutique",
      partyId: party,
      paymentMethod: "note",
      lines: [
        { productId: oil, quantity: 10, piecePrice: 280, cartonPrice: 3200 },
      ],
    })
  ).id;
  const onceExpense = (
    await command({
      type: "expense.post",
      title: "نقل",
      amount: 500,
      frequency: "once",
      occurredAt: "2026-08-14",
    })
  ).id;
  const dailyExpense = (
    await command({
      type: "expense.post",
      title: "غداء العمال",
      amount: 300,
      frequency: "daily",
      occurredAt: "2026-08-14",
    })
  ).id;
  await command({
    type: "expense.materialize",
    recurringId: (await state()).recurringExpenses.find(
      (x) => x.title === "غداء العمال",
    ).id,
    dueDate: "2026-08-14",
  });
  const monthlyExpense = (
    await command({
      type: "expense.post",
      title: "الإيجار",
      amount: 5000,
      frequency: "monthly",
      occurredAt: "2026-08-01",
    })
  ).id;
  const returned = (
    await command({
      type: "sale.return",
      saleId: cashSale,
      lines: [{ productId: rice, quantity: 2 }],
    })
  ).id;
  const adjusted = (
    await command({
      type: "adjustment.post",
      warehouseId: "wh-boutique",
      lines: [{ productId: rice, actualQuantity: 39 }],
    })
  ).id;
  const payment = (
    await command({
      type: "payment.post",
      partyId: party,
      side: "receivable",
      amount: 500,
      paymentMethod: "cash",
    })
  ).id;
  const offset = (
    await command({ type: "offset.post", partyId: party, amount: 1000 })
  ).id;
  const settlement = (
    await command({
      type: "settlement.post",
      partyId: party,
      side: "payable",
      amount: 500,
      paymentMethod: "cash",
    })
  ).id;

  snapshot = await state();
  const dailyDocs = snapshot.documents.filter(
    (d) => d.title === "غداء العمال" && d.occurredAt.startsWith("2026-08-14"),
  );
  assert.equal(
    dailyDocs.length,
    1,
    "a recurring due date is materialized once",
  );
  assert.equal(
    snapshot.products.find((p) => p.id === rice).stocks["wh-boutique"],
    39,
  );
  assert.ok(snapshot.parties.find((p) => p.id === party).receivable >= 0);
  assert.ok(snapshot.parties.find((p) => p.id === party).payable >= 0);

  const beforeFailedSale = snapshot.products.find((p) => p.id === oil).stocks[
    "wh-boutique"
  ];
  await command(
    {
      type: "sale.post",
      warehouseId: "wh-boutique",
      paymentMethod: "cash",
      lines: [
        { productId: oil, quantity: 99999, piecePrice: 280, cartonPrice: 3200 },
      ],
    },
    400,
  );
  snapshot = await state();
  assert.equal(
    snapshot.products.find((p) => p.id === oil).stocks["wh-boutique"],
    beforeFailedSale,
    "failed sale is atomic",
  );

  const expected = [
    purchase,
    transfer,
    cashSale,
    noteSale,
    onceExpense,
    dailyExpense,
    monthlyExpense,
    returned,
    adjusted,
    payment,
    offset,
    settlement,
  ];
  for (const documentId of expected)
    assert.ok(
      snapshot.documents.some((d) => d.id === documentId),
      `document ${documentId} remains traceable`,
    );
  for (const movement of snapshot.movements)
    assert.ok(
      snapshot.documents.some((d) => d.id === movement.documentId),
      "every stock movement opens an origin document",
    );
});
