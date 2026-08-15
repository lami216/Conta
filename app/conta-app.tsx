"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Boxes,
  ClipboardCheck,
  FileText,
  Menu,
  PackagePlus,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  kindLabels,
  money,
  number,
  paymentMethods,
  quantity,
  saleLineTotal,
  type BootstrapData,
  type DocumentRecord,
  type Party,
  type Product,
} from "./domain";

type View =
  | "pos"
  | "purchases"
  | "expenses"
  | "parties"
  | "suppliers"
  | "warehouses"
  | "transfers"
  | "adjustments"
  | "records"
  | "reports";
type RunCommand = (
  body: Record<string, unknown>,
  message: string,
) => Promise<string>;
type DraftLine = {
  productId: string;
  quantity: string;
  piecePrice: string;
  cartonPrice: string;
  unitPrice: string;
  actualQuantity: string;
  pricingMode: "piece" | "carton";
};
const empty: BootstrapData = {
  parties: [],
  warehouses: [],
  products: [],
  documents: [],
  movements: [],
  recurringExpenses: [],
};
const nav: Array<{ id: View; label: string; icon: typeof ShoppingCart }> = [
  { id: "pos", label: "نقطة البيع", icon: ShoppingCart },
  { id: "purchases", label: "فواتير الشراء", icon: PackagePlus },
  { id: "expenses", label: "فواتير المصاريف", icon: WalletCards },
  { id: "parties", label: "العملاء والملاحظات", icon: Users },
  { id: "suppliers", label: "الموردون", icon: Users },
  { id: "warehouses", label: "المخازن", icon: Boxes },
  { id: "transfers", label: "التحويلات", icon: ArrowLeftRight },
  { id: "adjustments", label: "تصحيح المخزون", icon: ClipboardCheck },
  { id: "records", label: "السجلات", icon: FileText },
  { id: "reports", label: "التقارير", icon: Receipt },
];
const val = (v: string) => (v === "" ? 0 : Number(v)),
  lineFor = (p: Product): DraftLine => ({
    productId: p.id,
    quantity: "1",
    piecePrice: String(p.piecePrice ?? 0),
    cartonPrice: String(
      p.cartonPrice ?? (p.piecePrice ?? 0) * p.piecesPerCarton,
    ),
    unitPrice: String(p.pieceCost),
    actualQuantity: "",
    pricingMode: "piece",
  });

export default function ContaApp() {
  const [data, setData] = useState<BootstrapData>(empty),
    [view, setView] = useState<View>("pos"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [menu, setMenu] = useState(false),
    [doc, setDoc] = useState<DocumentRecord | null>(null),
    [partyDetail, setPartyDetail] = useState<Party | null>(null);
  async function reload() {
    setLoading(true);
    try {
      const r = await fetch("/api/bootstrap");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function run(body: Record<string, unknown>, message: string) {
    setError("");
    const r = await fetch("/api/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "تعذر تنفيذ العملية");
      throw new Error(j.error);
    }
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
    await reload();
    return j.id as string;
  }
  const openDoc = (id: string) => {
    const found = data.documents.find((x) => x.id === id);
    if (found) setDoc(found);
  };
  return (
    <div className="app-shell" dir="rtl">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <b>ك</b>
          <div>
            <strong>Conta</strong>
            <span>نظام المتجر</span>
          </div>
          <button className="icon mobile" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "nav active" : "nav"}
              onClick={() => {
                setView(n.id);
                setDoc(null);
                setPartyDetail(null);
                setMenu(false);
              }}
            >
              <n.icon />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <span className="dot" /> قاعدة البيانات متصلة
          <form action="/api/auth/logout" method="post"><button type="submit">تسجيل الخروج</button></form>
        </div>
      </aside>
      <main>
        <header>
          <button className="icon mobile" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div>
            <small>CONTA POS</small>
            <h1>{nav.find((n) => n.id === view)?.label}</h1>
          </div>
          <button className="soft" onClick={() => void reload()}>
            <RefreshCw /> تحديث
          </button>
        </header>
        <div className="content">
          {notice && <div className="toast">{notice}</div>}
          {error && <div className="error">{error}</div>}
          {loading ? (
            <div className="loading">جاري تحميل السجلات…</div>
          ) : doc ? (
            <DocumentDetail
              document={doc}
              data={data}
              close={() => setDoc(null)}
              run={run}
            />
          ) : partyDetail ? (
            <PartyPage
              party={
                data.parties.find((p) => p.id === partyDetail.id) ?? partyDetail
              }
              data={data}
              close={() => setPartyDetail(null)}
              openDoc={openDoc}
              run={run}
            />
          ) : (
            <>
              {view === "pos" && (
                <Pos data={data} run={run} openDoc={openDoc} />
              )}{" "}
              {view === "purchases" && (
                <Purchases data={data} run={run} openDoc={openDoc} />
              )}{" "}
              {view === "expenses" && (
                <Expenses data={data} run={run} openDoc={openDoc} />
              )}{" "}
              {view === "parties" && (
                <Parties data={data} run={run} openParty={setPartyDetail} />
              )}{" "}
              {view === "suppliers" && (
                <Parties data={data} run={run} openParty={setPartyDetail} />
              )}{" "}
              {view === "warehouses" && (
                <Warehouses data={data} run={run} openDoc={openDoc} />
              )}{" "}
              {view === "transfers" && (
                <Transfer data={data} run={run} openDoc={openDoc} />
              )}{" "}
              {view === "adjustments" && (
                <Adjustment data={data} run={run} openDoc={openDoc} />
              )}{" "}
              {view === "records" && <Records data={data} openDoc={openDoc} />}{" "}
              {view === "reports" && (
                <Reports data={data} openDoc={openDoc} />
              )}{" "}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Num(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
}) {
  return (
    <input
      className="num"
      dir="ltr"
      inputMode="decimal"
      value={props.value}
      min={props.min ?? 0}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value.replace(/[^0-9.]/g, ""))}
    />
  );
}
function SearchProducts({
  data,
  query,
  setQuery,
  onPick,
}: {
  data: BootstrapData;
  query: string;
  setQuery: (v: string) => void;
  onPick: (p: Product) => void;
}) {
  const results = query.trim()
    ? data.products
        .filter((p) =>
          `${p.name} ${p.sku} ${p.barcode}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
        .slice(0, 8)
    : [];
  return (
    <div className="product-search">
      <label className="search">
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن منتج بالاسم أو الرمز"
        />
      </label>
      {results.length > 0 && (
        <div className="search-results">
          {results.map((p) => (
            <button key={p.id} onClick={() => onPick(p)}>
              <span>
                <strong>{p.name}</strong>
                <small>{p.sku}</small>
              </span>
              <Plus />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function LineEditor({
  line,
  product,
  onChange,
  onRemove,
  mode,
}: {
  line: DraftLine;
  product: Product;
  onChange: (x: DraftLine) => void;
  onRemove: () => void;
  mode: "sale" | "purchase" | "transfer" | "adjust";
}) {
  const qty = val(line.quantity),
    cartons = Math.floor(qty / product.piecesPerCarton);
  return (
    <div className="line">
      <div className="line-title">
        <span>
          <strong>{product.name}</strong>
          <small>
            {mode === "purchase" && qty
              ? `يعادل ${quantity(qty, product.piecesPerCarton)}`
              : `المتاح: ${number(Object.values(product.stocks).reduce((a, b) => a + b, 0))} فرد`}
          </small>
        </span>
        <button className="icon danger" onClick={onRemove}>
          <X />
        </button>
      </div>
      <div className="line-fields">
        {mode === "adjust" ? (
          <label>
            الكمية الفعلية
            <Num
              value={line.actualQuantity}
              onChange={(v) => onChange({ ...line, actualQuantity: v })}
            />
          </label>
        ) : (
          <label>
            الكمية بالأفراد
            <Num
              value={line.quantity}
              onChange={(v) => onChange({ ...line, quantity: v })}
            />
          </label>
        )}
        {mode === "sale" && (
          <label>
            سعر الفرد
            <Num
              value={line.piecePrice}
              onChange={(v) => onChange({ ...line, piecePrice: v, pricingMode: "piece" })}
            />
          </label>
        )}
        {mode === "sale" && cartons > 0 && <label>طريقة التسعير<select value={line.pricingMode} onChange={e => onChange({ ...line, pricingMode: e.target.value as "piece" | "carton" })}><option value="piece">سعر الفرد</option><option value="carton">سعر الكرتون</option></select></label>}
        {mode === "sale" && cartons > 0 && line.pricingMode === "carton" && <label>سعر الكرتون<Num value={line.cartonPrice} onChange={v => onChange({ ...line, cartonPrice: v })} /></label>}
        {mode === "purchase" && (
          <label>
            سعر الشراء للفرد
            <Num
              value={line.unitPrice}
              onChange={(v) => onChange({ ...line, unitPrice: v })}
            />
          </label>
        )}
      </div>
      {mode === "sale" && (
        <b className="line-total">
          {money(
            saleLineTotal(
              qty,
              product.piecesPerCarton,
              val(line.piecePrice),
              val(line.cartonPrice),
              line.pricingMode,
            ),
          )}
        </b>
      )}
    </div>
  );
}

function Pos({
  data,
  run,
  openDoc,
}: {
  data: BootstrapData;
  run: RunCommand;
  openDoc: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [lines, setLines] = useState<DraftLine[]>([]),
    [payment, setPayment] = useState("cash"),
    [paidAmount, setPaidAmount] = useState(""),
    [partyId, setPartyId] = useState(""),
    [quick, setQuick] = useState(false);
  const wh = data.warehouses.find((w) => w.isSalesDefault),
    details = lines.flatMap((l) => {
      const p = data.products.find((x) => x.id === l.productId);
      return p
        ? [
            {
              l,
              p,
              total: saleLineTotal(
                val(l.quantity),
                p.piecesPerCarton,
                val(l.piecePrice),
                val(l.cartonPrice),
                l.pricingMode,
              ),
            },
          ]
        : [];
    }),
    total = details.reduce((s, x) => s + x.total, 0);
  function add(p: Product) {
    setLines((x) => [lineFor(p), ...x.filter((l) => l.productId !== p.id)]);
    setQuery("");
  }
  async function submit() {
    const id = await run(
      {
        type: "sale.post",
        warehouseId: wh?.id,
        paymentMethod: payment,
        paidAmount: payment === "note" ? val(paidAmount) : total,
        partyId: payment === "note" ? partyId : null,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: val(l.quantity),
          piecePrice: val(l.piecePrice),
          cartonPrice: val(l.cartonPrice),
          pricingMode: l.pricingMode,
        })),
      },
      "تم اعتماد فاتورة البيع",
    );
    setLines([]);
    openDoc(id);
  }
  return (
    <section>
      <div className="hero">
        <div>
          <span>فاتورة جديدة</span>
          <h2>بيع من {wh?.name ?? "مخزن البيع"}</h2>
        </div>
        <b>{money(total)}</b>
      </div>
      <div className="pos-grid">
        <div className="panel">
          <SearchProducts
            data={data}
            query={query}
            setQuery={setQuery}
            onPick={add}
          />
          <div
            className={
              lines.length > 3 ? "invoice-lines scroll" : "invoice-lines"
            }
          >
            {lines.length ? (
              details.map(({ l, p }) => (
                <LineEditor
                  key={l.productId}
                  line={l}
                  product={p}
                  mode="sale"
                  onChange={(x) =>
                    setLines((s) =>
                      s.map((a) => (a.productId === x.productId ? x : a)),
                    )
                  }
                  onRemove={() =>
                    setLines((s) =>
                      s.filter((a) => a.productId !== l.productId),
                    )
                  }
                />
              ))
            ) : (
              <Empty text="ابحث عن منتج لإضافته إلى الفاتورة" />
            )}
          </div>
        </div>
        <div className="panel checkout">
          <h3>طريقة الدفع</h3>
          <div className="pay-grid">
            {paymentMethods.map((p) => (
              <button
                key={p.id}
                className={payment === p.id ? "choice selected" : "choice"}
                onClick={() => setPayment(p.id)}
              >
                {p.label}
              </button>
            ))}
            <button
              className={payment === "note" ? "choice selected" : "choice"}
              onClick={() => setPayment("note")}
            >
              ملاحظة
            </button>
          </div>
          {payment === "note" && (
            <>
              <label>
                المبلغ المدفوع
                <Num value={paidAmount} onChange={setPaidAmount} />
              </label>
              <label>
                العميل
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                >
                  <option value="">اختر العميل</option>
                  {data.parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="link" onClick={() => setQuick(!quick)}>
                <Plus /> إضافة عميل
              </button>
              {quick && <QuickParty run={run} onDone={() => setQuick(false)} />}
            </>
          )}
          <div className="total">
            <span>إجمالي الفاتورة</span>
            <strong>{money(total)}</strong>
          </div>
          <button
            className="primary wide"
            disabled={!lines.length || !wh || (payment === "note" && (!partyId || val(paidAmount) > total))}
            onClick={() => void submit()}
          >
            إتمام البيع
          </button>
        </div>
      </div>
      <Recent
        title="فواتير بيع أخيرة"
        docs={data.documents.filter((d) => d.kind === "sale")}
        openDoc={openDoc}
      />
    </section>
  );
}

function QuickParty({ run, onDone }: { run: RunCommand; onDone: () => void }) {
  const [name, setName] = useState(""),
    [phone, setPhone] = useState("");
  return (
    <div className="mini-form">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="اسم العميل"
      />
      <input
        dir="ltr"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="رقم الهاتف"
      />
      <button
        className="primary"
        onClick={async () => {
          await run({ type: "party.create", name, phone }, "تمت إضافة العميل");
          onDone();
        }}
      >
        حفظ
      </button>
    </div>
  );
}
function Purchases({
  data,
  run,
  openDoc,
}: {
  data: BootstrapData;
  run: RunCommand;
  openDoc: (id: string) => void;
}) {
  const [partyId, setPartyId] = useState(""),
    [locked, setLocked] = useState(false),
    [warehouseId, setWarehouseId] = useState(""),
    [query, setQuery] = useState(""),
    [lines, setLines] = useState<DraftLine[]>([]),
    [payment, setPayment] = useState("cash"),
    [paidAmount, setPaidAmount] = useState(""),
    [addingWh, setAddingWh] = useState(false);
  function add(p: Product) {
    setLines((x) =>
      x.some((l) => l.productId === p.id) ? x : [...x, lineFor(p)],
    );
    setQuery("");
  }
  async function submit() {
    const id = await run(
      {
        type: "purchase.post",
        partyId,
        warehouseId,
        paymentMethod: payment,
        paidAmount: payment === "note" ? val(paidAmount) : undefined,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: val(l.quantity),
          unitPrice: val(l.unitPrice),
        })),
      },
      "تم اعتماد فاتورة الشراء",
    );
    setLines([]);
    setPartyId("");
    setLocked(false);
    openDoc(id);
  }
  return (
    <section>
      <Heading title="فاتورة شراء جديدة" />
      <div className="panel form-stack">
        <div className="form-row">
          <label>
            المورد
            <select
              disabled={locked}
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            >
              <option value="">ابحث واختر المورد</option>
              {data.parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.phone}
                </option>
              ))}
            </select>
          </label>
          {locked ? (
            <button
              className="soft"
              onClick={() => {
                if (
                  confirm(
                    "هل أنت متأكد من تغيير المورد؟ ستبقى المنتجات كما هي.",
                  )
                )
                  setLocked(false);
              }}
            >
              تعديل المورد
            </button>
          ) : (
            <button
              className="soft"
              disabled={!partyId}
              onClick={() => setLocked(true)}
            >
              تأكيد المورد
            </button>
          )}
          <label>
            المخزن
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">اختر مخزن الاستلام</option>
              {data.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <button className="link" onClick={() => setAddingWh(!addingWh)}>
            <Plus /> إضافة مخزن جديد
          </button>
        </div>
        {addingWh && (
          <InlineCreate
            label="اسم المخزن"
            onSave={async (name) => {
              await run({ type: "warehouse.create", name }, "تمت إضافة المخزن");
              setAddingWh(false);
            }}
          />
        )}
        <SearchProducts
          data={data}
          query={query}
          setQuery={setQuery}
          onPick={add}
        />
        <div className="compact-list">
          {lines.map((l) => {
            const p = data.products.find((x) => x.id === l.productId)!;
            return (
              <LineEditor
                key={l.productId}
                line={l}
                product={p}
                mode="purchase"
                onChange={(x) =>
                  setLines((s) =>
                    s.map((a) => (a.productId === x.productId ? x : a)),
                  )
                }
                onRemove={() =>
                  setLines((s) => s.filter((a) => a.productId !== l.productId))
                }
              />
            );
          })}
        </div>
        <div className="form-row">
          <label>
            التسوية
            <select
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            >
              <option value="cash">مدفوعة مباشرة</option>
              <option value="note">مستحقة للمورد</option>
            </select>
          </label>
          {payment === "note" && <label>المدفوع الآن<Num value={paidAmount} onChange={setPaidAmount} /></label>}
          <button
            className="primary"
            disabled={!locked || !warehouseId || !lines.length}
            onClick={() => void submit()}
          >
            اعتماد الفاتورة كاملة
          </button>
        </div>
      </div>
      <Recent
        title="مشتريات أخيرة"
        docs={data.documents.filter((d) => d.kind === "purchase")}
        openDoc={openDoc}
      />
    </section>
  );
}

function Expenses({
  data,
  run,
  openDoc,
}: {
  data: BootstrapData;
  run: RunCommand;
  openDoc: (id: string) => void;
}) {
  const [title, setTitle] = useState(""),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [frequency, setFrequency] = useState("once");
  return (
    <section>
      <Heading title="فاتورة مصروفات جديدة" />
      <form
        className="panel form-row"
        onSubmit={async (e) => {
          e.preventDefault();
          const id = await run(
            {
              type: "expense.post",
              title,
              amount: val(amount),
              occurredAt: date,
              frequency,
            },
            "تم تسجيل المصروف",
          );
          setTitle("");
          setAmount("");
          openDoc(id);
        }}
      >
        <label>
          عنوان المصروف
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          المبلغ
          <Num value={amount} onChange={setAmount} />
        </label>
        <label>
          التاريخ
          <input
            dir="ltr"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          التكرار
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          >
            <option value="once">مرة واحدة</option>
            <option value="daily">يومي</option>
            <option value="monthly">شهري</option>
          </select>
        </label>
        <button className="primary">حفظ الفاتورة</button>
      </form>
      {data.recurringExpenses.length > 0 && (
        <div className="panel">
          <Heading title="المصاريف المتكررة" />
          {data.recurringExpenses.map((r) => (
            <div className="list-row" key={r.id}>
              <span>
                <strong>{r.title}</strong>
                <small>
                  {r.frequency === "daily" ? "يومي" : "شهري"} منذ {r.startsOn}
                </small>
              </span>
              <b>{money(r.amount)}</b>
              <button
                className="soft"
                onClick={() =>
                  void run(
                    {
                      type: "expense.materialize",
                      recurringId: r.id,
                      dueDate: new Date().toISOString().slice(0, 10),
                    },
                    "تم احتساب الاستحقاق دون تكرار",
                  )
                }
              >
                احتساب الاستحقاق
              </button>
            </div>
          ))}
        </div>
      )}
      <Recent
        title="فواتير المصاريف"
        docs={data.documents.filter((d) => d.kind === "expense")}
        openDoc={openDoc}
      />
    </section>
  );
}

function Parties({
  data,
  run,
  openParty,
}: {
  data: BootstrapData;
  run: RunCommand;
  openParty: (p: Party) => void;
}) {
  const [q, setQ] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState("");
  const list = [...data.parties]
    .sort((a, b) => {
      const s = q.toLowerCase();
      const score = (p: Party) =>
        p.name.toLowerCase() === s
          ? 0
          : p.name.toLowerCase().startsWith(s)
            ? 1
            : p.name.toLowerCase().includes(s)
              ? 2
              : p.phone.includes(s)
                ? 3
                : 9;
      return score(a) - score(b);
    })
    .filter(
      (p) =>
        !q || `${p.name} ${p.phone}`.toLowerCase().includes(q.toLowerCase()),
    );
  return (
    <section>
      <div className="toolbar">
        <label className="search">
          <Search />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الهاتف"
          />
        </label>
      </div>
      <form
        className="panel mini-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await run(
            { type: "party.create", name, phone },
            "تمت إضافة الطرف كعميل ومورد تلقائيًا",
          );
          setName("");
          setPhone("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم العميل أو المورد"
        />
        <input
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="رقم الهاتف"
        />
        <button className="primary">
          <Plus /> إضافة طرف
        </button>
      </form>
      <div className="party-grid">
        {list.map((p) => (
          <article
            className="party-card"
            key={p.id}
            onClick={() => openParty(p)}
          >
            <div className="avatar">{p.name.slice(0, 1)}</div>
            <div>
              <h3>{p.name}</h3>
              <small dir="ltr">{p.phone || "—"}</small>
              <div className="balances">
                <span>
                  لنا عليه <b>{money(p.receivable)}</b>
                </span>
                <span>
                  له علينا <b>{money(p.payable)}</b>
                </span>
              </div>
            </div>
            <button className="soft">كشف الحساب</button>
          </article>
        ))}
      </div>
    </section>
  );
}
function PartyPage({
  party,
  data,
  close,
  openDoc,
  run,
}: {
  party: Party;
  data: BootstrapData;
  close: () => void;
  openDoc: (id: string) => void;
  run: RunCommand;
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [amount, setAmount] = useState(""),
    [side, setSide] = useState("receivable"),
    [action, setAction] = useState("payment");
  const docs = data.documents.filter(
    (d) =>
      d.partyId === party.id &&
      (!from || d.occurredAt.slice(0, 10) >= from) &&
      (!to || d.occurredAt.slice(0, 10) <= to),
  );
  async function submit() {
    await run(
      {
        type: `${action}.post`,
        partyId: party.id,
        amount: val(amount),
        side,
        paymentMethod: "cash",
      },
      action === "offset" ? "تمت المقاصة" : "تم تسجيل العملية",
    );
    setAmount("");
  }
  return (
    <section>
      <button className="back" onClick={close}>
        ← العودة إلى الأطراف
      </button>
      <div className="hero party-hero">
        <div>
          <span>حساب طرف موحد</span>
          <h2>{party.name}</h2>
          <p dir="ltr">{party.phone || "—"}</p>
        </div>
        <div className="hero-stats">
          <span>
            لنا عليه <b>{money(party.receivable)}</b>
          </span>
          <span>
            له علينا <b>{money(party.payable)}</b>
          </span>
          <span>
            الصافي <b>{money(party.net)}</b>
          </span>
        </div>
      </div>
      <div className="panel form-row">
        <label>
          العملية
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="payment">تسجيل سداد</option>
            <option value="settlement">مخالصة/تسوية</option>
            <option value="offset">مقاصة</option>
          </select>
        </label>
        {action !== "offset" && (
          <label>
            جهة الرصيد
            <select value={side} onChange={(e) => setSide(e.target.value)}>
              <option value="receivable">مبلغ لنا عليه</option>
              <option value="payable">مبلغ له علينا</option>
            </select>
          </label>
        )}
        <label>
          المبلغ
          <Num value={amount} onChange={setAmount} />
        </label>
        <button className="primary" onClick={() => void submit()}>
          تسجيل العملية
        </button>
      </div>
      <div className="filters">
        <label>
          من
          <input
            type="date"
            dir="ltr"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          إلى
          <input
            type="date"
            dir="ltr"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <Recent
        title="الفواتير والدفعات والتسويات"
        docs={docs}
        openDoc={openDoc}
      />
    </section>
  );
}

function Warehouses({
  data,
  run,
  openDoc,
}: {
  data: BootstrapData;
  run: RunCommand;
  openDoc: (id: string) => void;
}) {
  const [wh, setWh] = useState(data.warehouses[0]?.id ?? ""),
    [q, setQ] = useState(""),
    [newName, setNewName] = useState(""),
    [productModal, setProductModal] = useState(false),
    [editingProduct, setEditingProduct] = useState<Product | null>(null),
    [rename, setRename] = useState(""),
    [moveProduct, setMoveProduct] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const active = data.warehouses.find((w) => w.id === wh),
    products = q
      ? data.products.filter((p) =>
          `${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase()),
        )
      : [],
    moves = data.movements.filter(
      (m) =>
        m.warehouseId === wh &&
        (!moveProduct || m.productId === moveProduct) &&
        (!from || m.occurredAt.slice(0, 10) >= from) &&
        (!to || m.occurredAt.slice(0, 10) <= to),
    );
  return (
    <section>
      <div className="warehouse-head">
        <label>
          المخزن النشط
          <select
            value={wh}
            onChange={(e) => {
              setWh(e.target.value);
              setQ("");
              setRename("");
            }}
          >
            {data.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="soft"
          disabled={active?.isSalesDefault}
          onClick={() =>
            void run(
              { type: "warehouse.default", warehouseId: wh },
              "تم تحديد مخزن البيع الافتراضي",
            )
          }
        >
          جعله مخزن البيع الافتراضي
        </button>
      </div>
      <div className="hero">
        <div>
          <span>المخزن المختار</span>
          <h2>{active?.name}</h2>
        </div>
        <b>{active?.isSalesDefault ? "مخزن البيع الافتراضي" : "مخزن مسجل"}</b>
      </div>
      <div className="panel mini-form">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="اسم مخزن جديد"
        />
        <button
          className="soft"
          onClick={async () => {
            await run(
              { type: "warehouse.create", name: newName },
              "تمت إضافة المخزن",
            );
            setNewName("");
          }}
        >
          <Plus /> إضافة مخزن
        </button>
        <button
          className="primary"
          onClick={() => {
            setEditingProduct(null);
            setProductModal(true);
          }}
        >
          <Plus /> إضافة منتج
        </button>
        <input
          value={rename}
          onChange={(e) => setRename(e.target.value)}
          placeholder={`تعديل اسم ${active?.name ?? "المخزن"}`}
        />
        <button
          className="soft"
          disabled={!active || !rename.trim()}
          onClick={async () => {
            await run(
              { type: "warehouse.update", id: wh, name: rename },
              "تم تعديل اسم المخزن",
            );
            setRename("");
          }}
        >
          حفظ اسم المخزن
        </button>
      </div>
      {productModal && (
        <ProductForm
          run={run}
          product={editingProduct}
          close={() => setProductModal(false)}
        />
      )}
      <div className="panel">
        <Heading title="منتجات المخزن" />
        <label className="search">
          <Search />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث لتظهر المنتجات"
          />
        </label>
        {products.map((p) => (
          <div className="product-row" key={p.id}>
            <span>
              <strong>{p.name}</strong>
              <small>{p.sku}</small>
            </span>
            <b>{quantity(p.stocks[wh] ?? 0, p.piecesPerCarton)}</b>
            <span>
              {p.piecePrice == null ? "بدون سعر بيع" : money(p.piecePrice)}
            </span>
            <button
              className="soft"
              onClick={() => {
                setEditingProduct(p);
                setProductModal(true);
              }}
            >
              تعديل
            </button>
          </div>
        ))}
        {!q && (
          <Empty text="لن نعرض كتالوجًا بطول فاتورة الكهرباء. ابدأ بالبحث." />
        )}
      </div>
      <div className="panel">
        <Heading title="حركة المنتجات" />
        <div className="filters">
          <select
            value={moveProduct}
            onChange={(e) => setMoveProduct(e.target.value)}
          >
            <option value="">كل المنتجات</option>
            {data.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            dir="ltr"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            dir="ltr"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {moves.map((m) => (
          <button
            className="list-row clickable"
            key={m.id}
            onClick={() => openDoc(m.documentId)}
          >
            <span>
              <strong>{m.productName}</strong>
              <small>
                {m.type} · {m.documentNumber}
              </small>
            </span>
            <b className={m.quantityDelta >= 0 ? "green" : "red"}>
              {m.quantityDelta >= 0 ? "+" : ""}
              {number(m.quantityDelta)}
            </b>
            <small>
              {m.balanceBefore} ← {m.balanceAfter}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
function ProductForm({
  run,
  close,
  product,
}: {
  run: RunCommand;
  close: () => void;
  product: Product | null;
}) {
  const [name, setName] = useState(product?.name ?? ""),
    [cost, setCost] = useState(String(product?.pieceCost ?? "")),
    [price, setPrice] = useState(String(product?.piecePrice ?? "")),
    [carton, setCarton] = useState(String(product?.cartonPrice ?? "")),
    [pack, setPack] = useState(String(product?.piecesPerCarton ?? 1)),
    [sku, setSku] = useState(product?.sku ?? ""),
    [barcode, setBarcode] = useState(product?.barcode ?? "");
  return (
    <form
      className="panel form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        const sensitive =
          product &&
          (name.trim() !== product.name || val(cost) !== product.pieceCost);
        const confirmed = sensitive
          ? window.confirm(
              `أنت تغيّر ${name.trim() !== product.name ? `اسم المنتج من «${product.name}» إلى «${name}»` : ""}${name.trim() !== product.name && val(cost) !== product.pieceCost ? " و" : ""}${val(cost) !== product.pieceCost ? ` سعر الشراء من ${product.pieceCost} إلى ${val(cost)} MRU` : ""}. هل تريد المتابعة؟`,
            )
          : true;
        if (!confirmed) return;
        await run(
          {
            type: product ? "product.update" : "product.create",
            id: product?.id,
            name,
            pieceCost: val(cost),
            piecePrice: price,
            cartonPrice: carton,
            piecesPerCarton: val(pack),
            sku,
            barcode,
            confirmSensitive: confirmed,
          },
          product ? "تم تعديل المنتج" : "تم إنشاء المنتج",
        );
        close();
      }}
    >
      <label>
        1. اسم المنتج
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        2. سعر الشراء للفرد
        <Num value={cost} onChange={setCost} />
      </label>
      <label>
        3. سعر البيع (اختياري)
        <Num value={price} onChange={setPrice} />
      </label>
      <label>
        4. سعر بيع الكرتون (اختياري)
        <Num value={carton} onChange={setCarton} />
      </label>
      <label>
        5. عدد الأفراد داخل الكرتون
        <Num value={pack} onChange={setPack} />
      </label>
      <label>
        رمز المنتج
        <input dir="ltr" value={sku} onChange={(e) => setSku(e.target.value)} />
      </label>
      <label>
        الباركود
        <input
          dir="ltr"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
      </label>
      <button className="primary">
        {product ? "حفظ التعديلات" : "حفظ المنتج"}
      </button>
    </form>
  );
}

function MultiStockForm({
  data,
  mode,
  run,
  openDoc,
}: {
  data: BootstrapData;
  mode: "transfer" | "adjust";
  run: RunCommand;
  openDoc: (id: string) => void;
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [q, setQ] = useState(""),
    [reason, setReason] = useState(""),
    [lines, setLines] = useState<DraftLine[]>([]);
  async function submit() {
    const body =
      mode === "transfer"
        ? {
            type: "transfer.post",
            fromWarehouseId: from,
            toWarehouseId: to,
            lines: lines.map((l) => ({
              productId: l.productId,
              quantity: val(l.quantity),
            })),
          }
        : {
            type: "adjustment.post",
            warehouseId: from,
            reason,
            lines: lines.map((l) => ({
              productId: l.productId,
              actualQuantity: val(l.actualQuantity),
            })),
          };
    const id = await run(
      body,
      mode === "transfer" ? "تم التحويل بين المخازن" : "تم تسجيل تصحيح المخزون",
    );
    setLines([]);
    openDoc(id);
  }
  return (
    <div className="panel form-stack">
      <div className="form-row">
        <label>
          {mode === "transfer" ? "من" : "المخزن"}
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">اختر المخزن</option>
            {data.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        {mode === "transfer" && (
          <label>
            إلى
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">اختر الوجهة</option>
              {data.warehouses
                .filter((w) => w.id !== from)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      <SearchProducts
        data={data}
        query={q}
        setQuery={setQ}
        onPick={(p) => {
          setLines((x) =>
            x.some((l) => l.productId === p.id) ? x : [...x, lineFor(p)],
          );
          setQ("");
        }}
      />
      {lines.map((l) => (
        <LineEditor
          key={l.productId}
          line={l}
          product={data.products.find((p) => p.id === l.productId)!}
          mode={mode}
          onChange={(x) =>
            setLines((s) => s.map((a) => (a.productId === x.productId ? x : a)))
          }
          onRemove={() =>
            setLines((s) => s.filter((a) => a.productId !== l.productId))
          }
        />
      ))}
      {mode === "adjust" && (
        <label>سبب التصحيح<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: نتيجة الجرد الفعلي" /></label>
      )}
      <button
        className="primary"
        disabled={!from || (mode === "transfer" && !to) || !lines.length || (mode === "adjust" && !reason.trim())}
        onClick={() => void submit()}
      >
        {mode === "transfer" ? "اعتماد التحويل" : "حفظ عملية التصحيح"}
      </button>
    </div>
  );
}
function Transfer(p: {
  data: BootstrapData;
  run: RunCommand;
  openDoc: (id: string) => void;
}) {
  return (
    <section>
      <Heading title="تحويل مرن بين أي مخزنين" />
      <MultiStockForm {...p} mode="transfer" />
      <Recent
        title="سجل التحويلات"
        docs={p.data.documents.filter((d) => d.kind === "transfer")}
        openDoc={p.openDoc}
      />
    </section>
  );
}
function Adjustment(p: {
  data: BootstrapData;
  run: RunCommand;
  openDoc: (id: string) => void;
}) {
  return (
    <section>
      <Heading title="تصحيح المخزون بالجرد الفعلي" />
      <MultiStockForm {...p} mode="adjust" />
      <Recent
        title="سجل التصحيحات"
        docs={p.data.documents.filter((d) => d.kind === "adjustment")}
        openDoc={p.openDoc}
      />
    </section>
  );
}
function Records({
  data,
  openDoc,
}: {
  data: BootstrapData;
  openDoc: (id: string) => void;
}) {
  const [kind, setKind] = useState(""),
    [q, setQ] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const docs = data.documents.filter(
    (d) =>
      (!kind || d.kind === kind) &&
      (!q ||
        `${d.number} ${d.partyName ?? ""} ${d.title ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (!from || d.occurredAt.slice(0, 10) >= from) &&
      (!to || d.occurredAt.slice(0, 10) <= to),
  );
  return (
    <section>
      <div className="filters">
        <label className="search">
          <Search />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="رقم المستند أو الطرف"
          />
        </label>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">كل المعاملات</option>
          {Object.entries(kindLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          type="date"
          dir="ltr"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date"
          dir="ltr"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <Recent title="كل السجلات القابلة للتتبع" docs={docs} openDoc={openDoc} />
    </section>
  );
}
function Reports({
  data,
  openDoc,
}: {
  data: BootstrapData;
  openDoc: (id: string) => void;
}) {
  const sales = data.documents
      .filter((d) => d.kind === "sale")
      .reduce((s, d) => s + d.total, 0),
    purchases = data.documents
      .filter((d) => d.kind === "purchase")
      .reduce((s, d) => s + d.total, 0),
    expenses = data.documents
      .filter((d) => d.kind === "expense")
      .reduce((s, d) => s + d.total, 0);
  return (
    <section>
      <div className="stats">
        <Stat label="المبيعات" value={money(sales)} />
        <Stat label="المشتريات" value={money(purchases)} />
        <Stat label="المصاريف" value={money(expenses)} />
        <Stat label="صافي التدفق" value={money(sales - purchases - expenses)} />
      </div>
      <Recent title="آخر المعاملات" docs={data.documents} openDoc={openDoc} />
    </section>
  );
}
function DocumentDetail({
  document,
  data,
  close,
  run,
}: {
  document: DocumentRecord;
  data: BootstrapData;
  close: () => void;
  run: RunCommand;
}) {
  const [returning, setReturning] = useState(false),
    [returns, setReturns] = useState<Record<string, string>>({});
  function download() {
    const content = [
      `${kindLabels[document.kind]} ${document.number}`,
      `التاريخ: ${document.occurredAt}`,
      `الطرف: ${document.partyName ?? "—"}`,
      `المخزن: ${document.warehouseName ?? "—"}`,
      ...document.lines.map(
        (l) =>
          `${l.description} | ${l.quantity} × ${l.unitPrice} = ${l.lineTotal}`,
      ),
      `الإجمالي: ${document.total} MRU`,
    ].join("\n");
    const a = window.document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([content], { type: "text/plain;charset=utf-8" }),
    );
    a.download = `${document.number}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <section>
      <div className="doc-actions">
        <button className="back" onClick={close}>
          ← العودة
        </button>
        <button className="soft" onClick={() => window.print()}>
          <Printer /> طباعة
        </button>
        <button className="soft" onClick={download}>
          تنزيل
        </button>
        {document.kind === "sale" && (
          <button className="warn" onClick={() => setReturning(!returning)}>
            <RotateCcw /> إرجاع جزئي
          </button>
        )}
      </div>
      <article className="document">
        <div className="document-head">
          <div>
            <span>{kindLabels[document.kind]}</span>
            <h2>{document.number}</h2>
            <small>{document.occurredAt}</small>
          </div>
          <b>{document.status === "posted" ? "معتمد" : document.status}</b>
        </div>
        <div className="doc-meta">
          <span>
            الطرف <b>{document.partyName ?? "—"}</b>
          </span>
          <span>
            المخزن <b>{document.warehouseName ?? "—"}</b>
          </span>
          {document.destinationWarehouseName && (
            <span>
              الوجهة <b>{document.destinationWarehouseName}</b>
            </span>
          )}
          <span>
            طريقة الدفع <b>{document.paymentMethod ?? "—"}</b>
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>البيان</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {document.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.description}</td>
                <td>{number(l.quantity)}</td>
                <td>{money(l.unitPrice)}</td>
                <td>{money(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="document-total">
          <span>الإجمالي</span>
          <strong>{money(document.total)}</strong>
        </div>
        {document.dueTotal > 0 && (
          <div className="due">
            <span>المستحق الأصلي {money(document.dueTotal)}</span>
            <span>المسوّى {money(document.paidTotal)}</span>
            <b>
              المتبقي{" "}
              {money(Math.max(0, document.dueTotal - document.paidTotal))}
            </b>
          </div>
        )}
      </article>
      {returning && (
        <div className="panel">
          <h3>حدد الكميات المرتجعة</h3>
          {document.lines
            .filter((l) => l.productId)
            .map((l) => (
              <label className="return-line" key={l.id}>
                <span>
                  {l.description} — المباع {number(l.quantity)}
                </span>
                <Num
                  value={returns[l.productId!] ?? ""}
                  onChange={(v) =>
                    setReturns((x) => ({ ...x, [l.productId!]: v }))
                  }
                />
              </label>
            ))}
          <button
            className="primary"
            onClick={async () => {
              await run(
                {
                  type: "sale.return",
                  saleId: document.id,
                  lines: Object.entries(returns)
                    .filter(([, v]) => val(v) > 0)
                    .map(([productId, v]) => ({ productId, quantity: val(v) })),
                },
                "تم الإرجاع وتحديث المخزون والحساب",
              );
              close();
            }}
          >
            اعتماد الإرجاع
          </button>
        </div>
      )}
      <Linked document={document} data={data} />
    </section>
  );
}
function Linked({
  document,
  data,
}: {
  document: DocumentRecord;
  data: BootstrapData;
}) {
  const linked = data.documents.filter(
    (d) =>
      d.parentDocumentId === document.id || d.id === document.parentDocumentId,
  );
  return linked.length ? (
    <div className="panel">
      <Heading title="المعاملات المرتبطة" />
      {linked.map((d) => (
        <div className="list-row" key={d.id}>
          <span>
            <strong>{kindLabels[d.kind]}</strong>
            <small>{d.number}</small>
          </span>
          <b>{money(d.total)}</b>
        </div>
      ))}
    </div>
  ) : null;
}

function Recent({
  title,
  docs,
  openDoc,
}: {
  title: string;
  docs: DocumentRecord[];
  openDoc: (id: string) => void;
}) {
  return (
    <div className="panel records">
      <Heading title={title} />
      {docs.slice(0, 100).map((d) => (
        <button
          className="list-row clickable"
          key={d.id}
          onClick={() => openDoc(d.id)}
        >
          <span>
            <strong>{d.partyName ?? d.title ?? kindLabels[d.kind]}</strong>
            <small>
              {d.number} ·{" "}
              {new Date(d.occurredAt).toLocaleString("ar-MR-u-nu-latn")}
            </small>
          </span>
          <span className="status">
            {d.dueTotal > 0 && d.paidTotal < d.dueTotal
              ? "مستحق"
              : "مدفوع/معتمد"}
          </span>
          <b>{money(d.total)}</b>
        </button>
      ))}
      {!docs.length && <Empty text="لا توجد معاملات بعد" />}
    </div>
  );
}
function Heading({ title }: { title: string }) {
  return (
    <div className="heading">
      <h2>{title}</h2>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function InlineCreate({
  label,
  onSave,
}: {
  label: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [v, setV] = useState("");
  return (
    <div className="mini-form">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={label}
      />
      <button className="primary" onClick={() => void onSave(v)}>
        حفظ
      </button>
    </div>
  );
}
