import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
type Obj = Record<string, unknown>;
const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
  id = (p: string) => `${p}-${crypto.randomUUID()}`;
const positive = (v: unknown, n: string) => {
    const x = Number(v);
    if (!Number.isFinite(x) || x <= 0) throw new Error(`${n} غير صالح`);
    return Math.round(x);
  },
  nonnegative = (v: unknown, n: string) => {
    const x = Number(v);
    if (!Number.isFinite(x) || x < 0) throw new Error(`${n} غير صالح`);
    return Math.round(x);
  },
  required = (v: unknown, n: string) => {
    const x = String(v ?? "").trim();
    if (!x) throw new Error(`${n} مطلوب`);
    return x;
  };
const docNumber = (k: string) =>
  `${({ purchase: "PUR", sale: "SAL", return: "RET", transfer: "TRF", adjustment: "ADJ", expense: "EXP", payment: "PAY", offset: "OFF", settlement: "SET" } as Record<string, string>)[k] ?? "DOC"}-${Date.now()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
async function one<T = Obj>(db: D1Database, sql: string, ...args: unknown[]) {
  return (await db
    .prepare(sql)
    .bind(...args)
    .first()) as T | null;
}
async function all<T = Obj>(db: D1Database, sql: string, ...args: unknown[]) {
  return (
    await db
      .prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
export async function bootstrap(db: D1Database) {
  const [ps, ws, products, stock, docs, lines, moves, recur] =
    await Promise.all([
      all(
        db,
        `SELECT p.*,COALESCE(SUM(CASE WHEN l.side='receivable' THEN l.amount_delta ELSE 0 END),0) receivable,COALESCE(SUM(CASE WHEN l.side='payable' THEN l.amount_delta ELSE 0 END),0) payable FROM parties p LEFT JOIN ledger_entries l ON l.party_id=p.id GROUP BY p.id ORDER BY p.name`,
      ),
      all(db, `SELECT * FROM warehouses ORDER BY is_sales_default DESC,name`),
      all(db, `SELECT * FROM products ORDER BY name`),
      all(db, `SELECT * FROM stock_balances`),
      all(
        db,
        `SELECT d.*,p.name party_name,w.name warehouse_name,dw.name destination_warehouse_name,COALESCE((SELECT SUM(a.amount) FROM allocations a WHERE a.source_document_id=d.id),0) paid_total FROM documents d LEFT JOIN parties p ON p.id=d.party_id LEFT JOIN warehouses w ON w.id=d.warehouse_id LEFT JOIN warehouses dw ON dw.id=d.destination_warehouse_id ORDER BY d.occurred_at DESC,d.created_at DESC LIMIT 500`,
      ),
      all(db, `SELECT * FROM document_lines ORDER BY rowid`),
      all(
        db,
        `SELECT m.*,d.number document_number,w.name warehouse_name,p.name product_name FROM stock_movements m JOIN documents d ON d.id=m.document_id JOIN warehouses w ON w.id=m.warehouse_id JOIN products p ON p.id=m.product_id ORDER BY m.occurred_at DESC LIMIT 1000`,
      ),
      all(db, `SELECT * FROM recurring_expenses ORDER BY created_at DESC`),
    ]);
  const stocks: Record<string, Record<string, number>> = {};
  for (const s of stock) {
    (stocks[String(s.product_id)] ??= {})[String(s.warehouse_id)] = Number(
      s.quantity,
    );
  }
  const byDoc: Record<string, Obj[]> = {};
  for (const l of lines)
    (byDoc[String(l.document_id)] ??= []).push({
      id: l.id,
      productId: l.product_id,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      lineTotal: Number(l.line_total),
    });
  return {
    parties: ps.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      receivable: Number(p.receivable),
      payable: Number(p.payable),
      net: Number(p.receivable) - Number(p.payable),
    })),
    warehouses: ws.map((w) => ({
      id: w.id,
      name: w.name,
      isSalesDefault: Boolean(w.is_sales_default),
    })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode ?? "",
      pieceCost: Number(p.piece_cost),
      piecePrice: p.piece_price == null ? null : Number(p.piece_price),
      cartonPrice: p.carton_price == null ? null : Number(p.carton_price),
      piecesPerCarton: Number(p.pieces_per_carton),
      stocks: stocks[String(p.id)] ?? {},
    })),
    documents: docs.map((d) => ({
      id: d.id,
      number: d.number,
      kind: d.kind,
      partyId: d.party_id,
      partyName: d.party_name,
      warehouseId: d.warehouse_id,
      warehouseName: d.warehouse_name,
      destinationWarehouseId: d.destination_warehouse_id,
      destinationWarehouseName: d.destination_warehouse_name,
      parentDocumentId: d.parent_document_id,
      paymentMethod: d.payment_method,
      status: d.status,
      title: d.title,
      total: Number(d.total),
      dueTotal: Number(d.due_total),
      paidTotal: Number(d.paid_total),
      occurredAt: d.occurred_at,
      lines: byDoc[String(d.id)] ?? [],
    })),
    movements: moves.map((m) => ({
      id: m.id,
      documentId: m.document_id,
      documentNumber: m.document_number,
      warehouseId: m.warehouse_id,
      warehouseName: m.warehouse_name,
      productId: m.product_id,
      productName: m.product_name,
      type: m.movement_type,
      quantityDelta: Number(m.quantity_delta),
      balanceBefore: Number(m.balance_before),
      balanceAfter: Number(m.balance_after),
      occurredAt: m.occurred_at,
    })),
    recurringExpenses: recur.map((r) => ({
      id: r.id,
      title: r.title,
      amount: Number(r.amount),
      frequency: r.frequency,
      startsOn: r.starts_on,
      active: Boolean(r.active),
    })),
  };
}
async function createParty(db: D1Database, b: Obj) {
  const x = id("pty");
  await db
    .prepare(`INSERT INTO parties(id,name,phone)VALUES(?,?,?)`)
    .bind(x, required(b.name, "اسم الطرف"), String(b.phone ?? "").trim())
    .run();
  return x;
}
async function createWarehouse(db: D1Database, b: Obj) {
  const x = id("wh");
  await db
    .prepare(`INSERT INTO warehouses(id,name)VALUES(?,?)`)
    .bind(x, required(b.name, "اسم المخزن"))
    .run();
  return x;
}
async function editWarehouse(db: D1Database, b: Obj) {
  const warehouseId = required(b.id, "المخزن");
  await db
    .prepare(`UPDATE warehouses SET name=? WHERE id=?`)
    .bind(required(b.name, "اسم المخزن"), warehouseId)
    .run();
  return warehouseId;
}
async function defaultWarehouse(db: D1Database, b: Obj) {
  const x = required(b.warehouseId, "المخزن");
  await db.batch([
    db.prepare(`UPDATE warehouses SET is_sales_default=0`),
    db.prepare(`UPDATE warehouses SET is_sales_default=1 WHERE id=?`).bind(x),
  ]);
  return x;
}
async function createProduct(db: D1Database, b: Obj) {
  const x = id("prd");
  await db
    .prepare(
      `INSERT INTO products(id,name,sku,barcode,piece_cost,piece_price,carton_price,pieces_per_carton)VALUES(?,?,?,?,?,?,?,?)`,
    )
    .bind(
      x,
      required(b.name, "اسم المنتج"),
      required(b.sku, "رمز المنتج"),
      String(b.barcode ?? "") || null,
      positive(b.pieceCost, "سعر الشراء"),
      b.piecePrice == null || b.piecePrice === ""
        ? null
        : nonnegative(b.piecePrice, "سعر البيع"),
      b.cartonPrice == null || b.cartonPrice === ""
        ? null
        : nonnegative(b.cartonPrice, "سعر الكرتون"),
      positive(b.piecesPerCarton, "عدد الأفراد في الكرتون"),
    )
    .run();
  return x;
}
async function editProduct(db: D1Database, b: Obj) {
  const x = required(b.id, "المنتج"),
    old = await one(db, `SELECT * FROM products WHERE id=?`, x);
  if (!old) throw new Error("المنتج غير موجود");
  const name = required(b.name, "اسم المنتج"),
    cost = positive(b.pieceCost, "سعر الشراء");
  if (
    (name !== old.name || cost !== Number(old.piece_cost)) &&
    b.confirmSensitive !== true
  )
    throw new Error("تغيير اسم المنتج أو سعر الشراء يحتاج تأكيدًا صريحًا");
  await db
    .prepare(
      `UPDATE products SET name=?,piece_cost=?,piece_price=?,carton_price=?,pieces_per_carton=?,barcode=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    )
    .bind(
      name,
      cost,
      b.piecePrice === "" ? null : nonnegative(b.piecePrice, "سعر البيع"),
      b.cartonPrice === "" ? null : nonnegative(b.cartonPrice, "سعر الكرتون"),
      positive(b.piecesPerCarton, "عدد الأفراد"),
      String(b.barcode ?? "") || null,
      x,
    )
    .run();
  return x;
}
const inputLines = (v: unknown) => {
  if (!Array.isArray(v) || !v.length)
    throw new Error("أضف منتجًا واحدًا على الأقل");
  return v as Obj[];
};
async function postPurchase(db: D1Database, b: Obj) {
  const did = id("doc"),
    num = docNumber("purchase"),
    pty = required(b.partyId, "المورد"),
    wh = required(b.warehouseId, "المخزن"),
    inputs = inputLines(b.lines),
    items: Obj[] = [];
  let total = 0;
  for (const raw of inputs) {
    const p = await one(
      db,
      `SELECT * FROM products WHERE id=?`,
      required(raw.productId, "المنتج"),
    );
    if (!p) throw new Error("منتج غير موجود");
    const qty = positive(raw.quantity, "الكمية"),
      unit = positive(raw.unitPrice, "سعر الشراء"),
      sum = qty * unit,
      bal = await one(
        db,
        `SELECT quantity FROM stock_balances WHERE warehouse_id=? AND product_id=?`,
        wh,
        p.id,
      ),
      before = Number(bal?.quantity ?? 0);
    total += sum;
    items.push({ p, qty, unit, sum, before });
  }
  const due = b.paymentMethod === "note" ? total : 0,
    stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO documents(id,number,kind,party_id,warehouse_id,payment_method,total,due_total,occurred_at)VALUES(?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP))`,
        )
        .bind(
          did,
          num,
          "purchase",
          pty,
          wh,
          String(b.paymentMethod ?? "cash"),
          total,
          due,
          b.occurredAt ?? null,
        ),
    ];
  for (const x of items) {
    const p = x.p as Obj,
      qty = Number(x.qty),
      before = Number(x.before);
    stmts.push(
      db
        .prepare(`INSERT INTO document_lines VALUES(?,?,?,?,?,?,?)`)
        .bind(id("lin"), did, p.id, p.name, qty, x.unit, x.sum),
      db
        .prepare(
          `INSERT INTO stock_balances(warehouse_id,product_id,quantity)VALUES(?,?,?)ON CONFLICT(warehouse_id,product_id)DO UPDATE SET quantity=excluded.quantity`,
        )
        .bind(wh, p.id, before + qty),
      db
        .prepare(
          `INSERT INTO stock_movements(id,document_id,warehouse_id,product_id,movement_type,quantity_delta,balance_before,balance_after)VALUES(?,?,?,?,?,?,?,?)`,
        )
        .bind(id("mov"), did, wh, p.id, "purchase", qty, before, before + qty),
    );
  }
  if (due)
    stmts.push(
      db
        .prepare(
          `INSERT INTO ledger_entries(id,document_id,party_id,side,amount_delta)VALUES(?,?,?,?,?)`,
        )
        .bind(id("led"), did, pty, "payable", due),
    );
  stmts.push(
    db
      .prepare(
        `INSERT INTO audit_events(id,document_id,action,payload)VALUES(?,?,?,?)`,
      )
      .bind(id("aud"), did, "purchase.posted", JSON.stringify(b)),
  );
  await db.batch(stmts);
  return did;
}
async function postSale(db: D1Database, b: Obj) {
  const did = id("doc"),
    num = docNumber("sale"),
    wh = required(b.warehouseId, "مخزن البيع"),
    pay = String(b.paymentMethod ?? "cash"),
    pty = b.partyId ? String(b.partyId) : null,
    inputs = inputLines(b.lines);
  if (pay === "note" && !pty) throw new Error("اختر العميل للملاحظة");
  const items: Obj[] = [];
  let total = 0;
  for (const raw of inputs) {
    const p = await one(
      db,
      `SELECT * FROM products WHERE id=?`,
      required(raw.productId, "المنتج"),
    );
    if (!p) throw new Error("منتج غير موجود");
    const qty = positive(raw.quantity, "الكمية"),
      pack = Number(p.pieces_per_carton),
      piece = nonnegative(raw.piecePrice ?? p.piece_price ?? 0, "سعر الفرد"),
      carton = nonnegative(
        raw.cartonPrice ?? p.carton_price ?? piece * pack,
        "سعر الكرتون",
      ),
      cartons = Math.floor(qty / pack),
      pieces = qty % pack,
      sum = Math.round(
        cartons ? cartons * carton + pieces * (carton / pack) : pieces * piece,
      ),
      bal = await one(
        db,
        `SELECT quantity FROM stock_balances WHERE warehouse_id=? AND product_id=?`,
        wh,
        p.id,
      ),
      before = Number(bal?.quantity ?? 0);
    if (before < qty) throw new Error(`المخزون غير كافٍ للمنتج ${p.name}`);
    total += sum;
    items.push({ p, qty, unit: cartons ? carton : piece, sum, before });
  }
  const due = pay === "note" ? total : 0,
    stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO documents(id,number,kind,party_id,warehouse_id,payment_method,total,due_total)VALUES(?,?,?,?,?,?,?,?)`,
        )
        .bind(did, num, "sale", pty, wh, pay, total, due),
    ];
  for (const x of items) {
    const p = x.p as Obj,
      qty = Number(x.qty),
      before = Number(x.before);
    stmts.push(
      db
        .prepare(`INSERT INTO document_lines VALUES(?,?,?,?,?,?,?)`)
        .bind(id("lin"), did, p.id, p.name, qty, x.unit, x.sum),
      db
        .prepare(
          `UPDATE stock_balances SET quantity=quantity-? WHERE warehouse_id=? AND product_id=? AND quantity>=?`,
        )
        .bind(qty, wh, p.id, qty),
      db
        .prepare(
          `INSERT INTO stock_movements(id,document_id,warehouse_id,product_id,movement_type,quantity_delta,balance_before,balance_after)VALUES(?,?,?,?,?,?,?,?)`,
        )
        .bind(id("mov"), did, wh, p.id, "sale", -qty, before, before - qty),
    );
  }
  if (due && pty)
    stmts.push(
      db
        .prepare(
          `INSERT INTO ledger_entries(id,document_id,party_id,side,amount_delta)VALUES(?,?,?,?,?)`,
        )
        .bind(id("led"), did, pty, "receivable", due),
    );
  stmts.push(
    db
      .prepare(
        `INSERT INTO audit_events(id,document_id,action,payload)VALUES(?,?,?,?)`,
      )
      .bind(id("aud"), did, "sale.posted", JSON.stringify(b)),
  );
  await db.batch(stmts);
  return did;
}
async function postReturn(db: D1Database, b: Obj) {
  const parentId = required(b.saleId, "فاتورة البيع"),
    parent = await one(
      db,
      `SELECT * FROM documents WHERE id=? AND kind='sale'`,
      parentId,
    );
  if (!parent) throw new Error("فاتورة البيع غير موجودة");
  const did = id("doc"),
    num = docNumber("return"),
    items: Obj[] = [];
  let total = 0;
  for (const raw of inputLines(b.lines)) {
    const productId = required(raw.productId, "المنتج"),
      original = await one(
        db,
        `SELECT dl.*,p.name FROM document_lines dl JOIN products p ON p.id=dl.product_id WHERE dl.document_id=? AND dl.product_id=?`,
        parentId,
        productId,
      );
    if (!original) throw new Error("المنتج ليس ضمن الفاتورة");
    const prev = await one(
        db,
        `SELECT COALESCE(SUM(dl.quantity),0) qty FROM documents d JOIN document_lines dl ON dl.document_id=d.id WHERE d.parent_document_id=? AND d.kind='return' AND dl.product_id=?`,
        parentId,
        productId,
      ),
      qty = positive(raw.quantity, "كمية الإرجاع");
    if (Number(prev?.qty ?? 0) + qty > Number(original.quantity))
      throw new Error("كمية الإرجاع تتجاوز الكمية المباعة");
    const sum = Math.round(
        (qty * Number(original.line_total)) / Number(original.quantity),
      ),
      bal = await one(
        db,
        `SELECT quantity FROM stock_balances WHERE warehouse_id=? AND product_id=?`,
        parent.warehouse_id,
        productId,
      ),
      before = Number(bal?.quantity ?? 0);
    total += sum;
    items.push({
      productId,
      name: original.name,
      qty,
      unit: Math.round(Number(original.line_total) / Number(original.quantity)),
      sum,
      before,
    });
  }
  const settled = await one(
      db,
      `SELECT COALESCE(SUM(amount),0) amount FROM allocations WHERE source_document_id=? AND side='receivable'`,
      parentId,
    ),
    previousReturns = await one(
      db,
      `SELECT COALESCE(SUM(total),0) amount FROM documents WHERE parent_document_id=? AND kind='return'`,
      parentId,
    ),
    remainingNote = Math.max(
      0,
      Number(parent.due_total) -
        Number(settled?.amount ?? 0) -
        Number(previousReturns?.amount ?? 0),
    ),
    noteReversal = Math.min(total, remainingNote);
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO documents(id,number,kind,party_id,warehouse_id,parent_document_id,payment_method,total,due_total)VALUES(?,?,?,?,?,?,?,?,0)`,
      )
      .bind(
        did,
        num,
        "return",
        parent.party_id,
        parent.warehouse_id,
        parentId,
        parent.payment_method,
        total,
      ),
  ];
  for (const x of items) {
    const qty = Number(x.qty),
      before = Number(x.before);
    stmts.push(
      db
        .prepare(`INSERT INTO document_lines VALUES(?,?,?,?,?,?,?)`)
        .bind(id("lin"), did, x.productId, x.name, qty, x.unit, x.sum),
      db
        .prepare(
          `UPDATE stock_balances SET quantity=quantity+? WHERE warehouse_id=? AND product_id=?`,
        )
        .bind(qty, parent.warehouse_id, x.productId),
      db
        .prepare(
          `INSERT INTO stock_movements(id,document_id,warehouse_id,product_id,movement_type,quantity_delta,balance_before,balance_after)VALUES(?,?,?,?,?,?,?,?)`,
        )
        .bind(
          id("mov"),
          did,
          parent.warehouse_id,
          x.productId,
          "return",
          qty,
          before,
          before + qty,
        ),
    );
  }
  if (parent.party_id && noteReversal)
    stmts.push(
      db
        .prepare(
          `INSERT INTO ledger_entries(id,document_id,party_id,side,amount_delta)VALUES(?,?,?,?,?)`,
        )
        .bind(id("led"), did, parent.party_id, "receivable", -noteReversal),
    );
  await db.batch(stmts);
  return did;
}
async function postTransfer(db: D1Database, b: Obj) {
  const from = required(b.fromWarehouseId, "مخزن المصدر"),
    to = required(b.toWarehouseId, "مخزن الوجهة");
  if (from === to) throw new Error("اختر مخزنين مختلفين");
  const did = id("doc"),
    stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO documents(id,number,kind,warehouse_id,destination_warehouse_id,total)VALUES(?,?,?,?,?,0)`,
        )
        .bind(did, docNumber("transfer"), "transfer", from, to),
    ];
  for (const raw of inputLines(b.lines)) {
    const pid = required(raw.productId, "المنتج"),
      qty = positive(raw.quantity, "الكمية"),
      p = await one(db, `SELECT name FROM products WHERE id=?`, pid),
      src = await one(
        db,
        `SELECT quantity FROM stock_balances WHERE warehouse_id=? AND product_id=?`,
        from,
        pid,
      ),
      dst = await one(
        db,
        `SELECT quantity FROM stock_balances WHERE warehouse_id=? AND product_id=?`,
        to,
        pid,
      ),
      a = Number(src?.quantity ?? 0),
      z = Number(dst?.quantity ?? 0);
    if (a < qty) throw new Error(`رصيد ${p?.name ?? "المنتج"} غير كافٍ`);
    stmts.push(
      db
        .prepare(`INSERT INTO document_lines VALUES(?,?,?,?,?,?,0)`)
        .bind(id("lin"), did, pid, p?.name ?? "منتج", qty, 0),
      db
        .prepare(
          `UPDATE stock_balances SET quantity=quantity-? WHERE warehouse_id=? AND product_id=? AND quantity>=?`,
        )
        .bind(qty, from, pid, qty),
      db
        .prepare(
          `INSERT INTO stock_balances(warehouse_id,product_id,quantity)VALUES(?,?,?)ON CONFLICT(warehouse_id,product_id)DO UPDATE SET quantity=excluded.quantity`,
        )
        .bind(to, pid, z + qty),
      db
        .prepare(
          `INSERT INTO stock_movements VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
        )
        .bind(id("mov"), did, from, pid, "transfer-out", -qty, a, a - qty),
      db
        .prepare(
          `INSERT INTO stock_movements VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
        )
        .bind(id("mov"), did, to, pid, "transfer-in", qty, z, z + qty),
    );
  }
  await db.batch(stmts);
  return did;
}
async function postAdjustment(db: D1Database, b: Obj) {
  const wh = required(b.warehouseId, "المخزن"),
    did = id("doc"),
    stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO documents(id,number,kind,warehouse_id,total,title)VALUES(?,?,?,?,0,?)`,
        )
        .bind(
          did,
          docNumber("adjustment"),
          "adjustment",
          wh,
          String(b.title ?? "جرد فعلي"),
        ),
    ];
  for (const raw of inputLines(b.lines)) {
    const pid = required(raw.productId, "المنتج"),
      actual = nonnegative(raw.actualQuantity, "الكمية الفعلية"),
      p = await one(db, `SELECT name FROM products WHERE id=?`, pid),
      bal = await one(
        db,
        `SELECT quantity FROM stock_balances WHERE warehouse_id=? AND product_id=?`,
        wh,
        pid,
      ),
      before = Number(bal?.quantity ?? 0),
      delta = actual - before;
    stmts.push(
      db
        .prepare(`INSERT INTO document_lines VALUES(?,?,?,?,?,?,0)`)
        .bind(id("lin"), did, pid, p?.name ?? "منتج", Math.abs(delta), 0),
      db
        .prepare(
          `INSERT INTO stock_balances(warehouse_id,product_id,quantity)VALUES(?,?,?)ON CONFLICT(warehouse_id,product_id)DO UPDATE SET quantity=excluded.quantity`,
        )
        .bind(wh, pid, actual),
      db
        .prepare(
          `INSERT INTO stock_movements VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
        )
        .bind(id("mov"), did, wh, pid, "adjustment", delta, before, actual),
    );
  }
  await db.batch(stmts);
  return did;
}
async function materialize(db: D1Database, b: Obj) {
  const rid = required(b.recurringId, "المصروف المتكرر"),
    r = await one(
      db,
      `SELECT * FROM recurring_expenses WHERE id=? AND active=1`,
      rid,
    );
  if (!r) throw new Error("المصروف المتكرر غير موجود");
  const due = String(b.dueDate ?? new Date().toISOString().slice(0, 10)).slice(
      0,
      10,
    ),
    key = `${rid}:${r.frequency === "monthly" ? due.slice(0, 7) : due}`,
    existing = await one(
      db,
      `SELECT id FROM documents WHERE recurrence_key=?`,
      key,
    );
  if (existing) return existing.id;
  const did = id("doc");
  await db.batch([
    db
      .prepare(
        `INSERT INTO documents(id,number,kind,title,total,due_total,recurrence_key,occurred_at)VALUES(?,?,?,?,?,0,?,?)`,
      )
      .bind(did, docNumber("expense"), "expense", r.title, r.amount, key, due),
    db
      .prepare(
        `INSERT INTO document_lines(id,document_id,description,quantity,unit_price,line_total)VALUES(?,?,?,1,?,?)`,
      )
      .bind(id("lin"), did, r.title, r.amount, r.amount),
  ]);
  return did;
}
async function postExpense(db: D1Database, b: Obj) {
  const amount = positive(b.amount, "المبلغ"),
    freq = String(b.frequency ?? "once"),
    title = required(b.title, "عنوان المصروف"),
    date = String(b.occurredAt ?? new Date().toISOString().slice(0, 10));
  if (freq !== "once") {
    const rid = id("rec");
    await db
      .prepare(
        `INSERT INTO recurring_expenses(id,title,amount,frequency,starts_on)VALUES(?,?,?,?,?)`,
      )
      .bind(rid, title, amount, freq, date.slice(0, 10))
      .run();
    return materialize(db, { recurringId: rid, dueDate: date });
  }
  const did = id("doc");
  await db.batch([
    db
      .prepare(
        `INSERT INTO documents(id,number,kind,title,total,due_total,occurred_at)VALUES(?,?,?,?,?,0,?)`,
      )
      .bind(did, docNumber("expense"), "expense", title, amount, date),
    db
      .prepare(
        `INSERT INTO document_lines(id,document_id,description,quantity,unit_price,line_total)VALUES(?,?,?,1,?,?)`,
      )
      .bind(id("lin"), did, title, amount, amount),
  ]);
  return did;
}
async function postPayment(
  db: D1Database,
  b: Obj,
  kind: "payment" | "settlement",
) {
  const pty = required(b.partyId, "الطرف"),
    side = String(b.side);
  if (!["receivable", "payable"].includes(side))
    throw new Error("نوع الرصيد غير صالح");
  const amount = positive(b.amount, "المبلغ"),
    sourceKind = side === "receivable" ? "sale" : "purchase",
    docs = await all(
      db,
      `SELECT d.id,d.due_total-COALESCE((SELECT SUM(a.amount)FROM allocations a WHERE a.source_document_id=d.id AND a.side=?),0) outstanding FROM documents d WHERE d.party_id=? AND d.due_total>0 AND d.kind=? ORDER BY d.occurred_at`,
      side,
      pty,
      sourceKind,
    );
  if (amount > docs.reduce((s, d) => s + Number(d.outstanding), 0))
    throw new Error("المبلغ يتجاوز الرصيد المستحق");
  let left = amount;
  const did = id("doc"),
    stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO documents(id,number,kind,party_id,payment_method,total,due_total)VALUES(?,?,?,?,?,?,0)`,
        )
        .bind(
          did,
          docNumber(kind),
          kind,
          pty,
          String(b.paymentMethod ?? "cash"),
          amount,
        ),
    ];
  for (const d of docs) {
    if (!left) break;
    const x = Math.min(left, Number(d.outstanding));
    if (x > 0) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO allocations(id,settlement_document_id,source_document_id,side,amount)VALUES(?,?,?,?,?)`,
          )
          .bind(id("alc"), did, d.id, side, x),
      );
      left -= x;
    }
  }
  stmts.push(
    db
      .prepare(
        `INSERT INTO ledger_entries(id,document_id,party_id,side,amount_delta)VALUES(?,?,?,?,?)`,
      )
      .bind(id("led"), did, pty, side, -amount),
  );
  await db.batch(stmts);
  return did;
}
async function postOffset(db: D1Database, b: Obj) {
  const pty = required(b.partyId, "الطرف"),
    amount = positive(b.amount, "المبلغ"),
    x = await one(
      db,
      `SELECT COALESCE(SUM(CASE WHEN side='receivable'THEN amount_delta ELSE 0 END),0) receivable,COALESCE(SUM(CASE WHEN side='payable'THEN amount_delta ELSE 0 END),0) payable FROM ledger_entries WHERE party_id=?`,
      pty,
    );
  if (amount > Math.min(Number(x?.receivable ?? 0), Number(x?.payable ?? 0)))
    throw new Error("المقاصة تتجاوز أصغر الرصيدين");
  const did = id("doc");
  await db.batch([
    db
      .prepare(
        `INSERT INTO documents(id,number,kind,party_id,total,due_total)VALUES(?,?,?,?,?,0)`,
      )
      .bind(did, docNumber("offset"), "offset", pty, amount),
    db
      .prepare(`INSERT INTO ledger_entries VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`)
      .bind(id("led"), did, pty, "receivable", -amount),
    db
      .prepare(`INSERT INTO ledger_entries VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`)
      .bind(id("led"), did, pty, "payable", -amount),
  ]);
  return did;
}
export async function command(db: D1Database, b: Obj) {
  switch (b.type) {
    case "party.create":
      return createParty(db, b);
    case "warehouse.create":
      return createWarehouse(db, b);
    case "warehouse.update":
      return editWarehouse(db, b);
    case "warehouse.default":
      return defaultWarehouse(db, b);
    case "product.create":
      return createProduct(db, b);
    case "product.update":
      return editProduct(db, b);
    case "purchase.post":
      return postPurchase(db, b);
    case "sale.post":
      return postSale(db, b);
    case "sale.return":
      return postReturn(db, b);
    case "transfer.post":
      return postTransfer(db, b);
    case "adjustment.post":
      return postAdjustment(db, b);
    case "expense.post":
      return postExpense(db, b);
    case "expense.materialize":
      return materialize(db, b);
    case "payment.post":
      return postPayment(db, b, "payment");
    case "settlement.post":
      return postPayment(db, b, "settlement");
    case "offset.post":
      return postOffset(db, b);
    default:
      throw new Error("العملية غير معروفة");
  }
}
const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/bootstrap")
        return env.DB
          ? json(await bootstrap(env.DB))
          : json({ error: "قاعدة البيانات غير مربوطة" }, 503);
      if (url.pathname === "/api/command" && request.method === "POST")
        return env.DB
          ? json({
              ok: true,
              id: await command(env.DB, (await request.json()) as Obj),
            })
          : json({ error: "قاعدة البيانات غير مربوطة" }, 503);
      if (url.pathname === "/_vinext/image") {
        const widths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
        return handleImageOptimization(
          request,
          {
            fetchAsset: (path) =>
              env.ASSETS.fetch(new Request(new URL(path, request.url))),
            transformImage: async (body, { width, format, quality }) =>
              (
                await env.IMAGES.input(body)
                  .transform(width > 0 ? { width } : {})
                  .output({ format, quality })
              ).response(),
          },
          widths,
        );
      }
      return handler.fetch(request, env, ctx);
    } catch (error) {
      return json(
        {
          error: error instanceof Error ? error.message : "تعذر تنفيذ العملية",
        },
        400,
      );
    }
  },
};
export default worker;
