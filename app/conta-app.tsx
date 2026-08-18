"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Boxes,
  Building2,
  ClipboardCheck,
  CalendarDays,
  ChevronDown,
  Landmark,
  Menu,
  PackagePlus,
  PencilLine,
  Plus,
  Printer,
  Receipt,
  ReceiptText,
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
  | "warehouses"
  | "transfers"
  | "adjustments"
  | "records"
  | "reports";
type RunCommand = (
  body: Record<string, unknown>,
  message: string,
) => Promise<string>;
type AdjustmentPrefill = { productId: string; warehouseId: string };
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
  financialMovements: [],
  paymentAccounts: [],
  recurringExpenses: [],
};
function useSessionDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try { const saved = sessionStorage.getItem(`conta:${key}`); return saved ? JSON.parse(saved) as T : initial; } catch { return initial; }
  });
  useEffect(() => { sessionStorage.setItem(`conta:${key}`, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}
const nav: Array<{ id: View; label: string; icon: typeof ShoppingCart }> = [
  { id: "pos", label: "نقطة البيع", icon: ShoppingCart },
  { id: "expenses", label: "فواتير المصاريف", icon: WalletCards },
  { id: "parties", label: "العملاء والملاحظات", icon: Users },
  { id: "reports", label: "التقارير", icon: Receipt },
];
const warehouseNav: Array<{ id: View; label: string; icon: typeof Boxes }> = [
  { id: "warehouses", label: "تفاصيل المخزن", icon: Boxes },
  { id: "purchases", label: "فواتير الشراء", icon: PackagePlus },
  { id: "transfers", label: "التحويلات", icon: ArrowLeftRight },
  { id: "adjustments", label: "تصحيح المخازن", icon: ClipboardCheck },
];
const val = (v: string) => (v === "" ? 0 : Number(v)),
  lineFor = (p: Product): DraftLine => ({
    productId: p.id,
    quantity: "1",
    piecePrice: String(p.piecePrice ?? 0),
    cartonPrice: String(
      p.cartonPrice ?? (p.piecePrice ?? 0) * (p.piecesPerCarton ?? 0),
    ),
    unitPrice: String(p.pieceCost ?? 0),
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
    [warehouseMenu, setWarehouseMenu] = useState(false),
    [doc, setDoc] = useState<DocumentRecord | null>(null),
    [partyDetail, setPartyDetail] = useState<Party | null>(null),
    [adjustmentPrefill, setAdjustmentPrefill] = useState<AdjustmentPrefill | null>(null);
  const warehouseMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!warehouseMenuRef.current?.contains(event.target as Node)) setWarehouseMenu(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const navigate = (id: View) => {
    if (id !== "adjustments") setAdjustmentPrefill(null);
    setView(id); setDoc(null); setPartyDetail(null); setMenu(false); setWarehouseMenu(false);
  };
  const openStockAdjustment = (prefill: AdjustmentPrefill) => {
    setAdjustmentPrefill(prefill);
    navigate("adjustments");
  };
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
  const activeWarehouse = data.warehouses.find((w) => w.isSalesDefault);
  const today = new Intl.DateTimeFormat("ar-MR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return (
    <div className="app-shell" dir="rtl">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <b>C</b>
          <div>
            <strong>Conta</strong>
            <span>نظام المتجر</span>
          </div>
          <button className="icon mobile" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <div className="warehouse-chip">
          <Boxes />
          <span><small>مخزن البيع النشط</small><strong>{activeWarehouse?.name ?? "غير محدد"}</strong></span>
        </div>
        <nav aria-label="التنقل الرئيسي">
          {nav.slice(0, 1).map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "nav active" : "nav"}
              onClick={() => navigate(n.id)}
            >
              <n.icon />
              <span>{n.label}</span>
            </button>
          ))}
          <div className="nav-menu" ref={warehouseMenuRef}>
            <button className={warehouseNav.some(n => n.id === view) ? "nav active" : "nav"} aria-expanded={warehouseMenu} onClick={() => setWarehouseMenu(x => !x)}>
              <Boxes /><span>المخازن</span><ChevronDown className="chevron" />
            </button>
            {warehouseMenu && <div className="nav-popover">
              {warehouseNav.map(n => <button key={n.id} className={view === n.id ? "active" : ""} onClick={() => navigate(n.id)}><n.icon /><span>{n.label}</span></button>)}
            </div>}
          </div>
          {nav.slice(1).map((n) => (
            <button key={n.id} className={view === n.id ? "nav active" : "nav"} onClick={() => navigate(n.id)}><n.icon /><span>{n.label}</span></button>
          ))}
        </nav>
        <div className="side-foot">
          <span className="owner-mark">م</span><strong>المالك</strong>
          <form action="/api/auth/logout" method="post"><button type="submit">تسجيل الخروج</button></form>
        </div>
      </aside>
      <main>
        <header className="page-bar">
          <button className="icon mobile" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <h1>{[...nav, ...warehouseNav].find((n) => n.id === view)?.label}</h1>
          <div className="date-chip"><CalendarDays /><span>{today}</span></div>
          <button className="icon refresh" title="تحديث البيانات" aria-label="تحديث البيانات" onClick={() => void reload()}><RefreshCw /></button>
        </header>
        <div className="content">
          {notice && <div className="toast">{notice}</div>}
          {error && <div className="error">{error}</div>}
          {loading ? (
            <div className="loading">جاري تحميل السجلات…</div>
          ) : doc ? (
            <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`سجل المعاملة ${doc.number}`}>
              <div className="modal-card"><DocumentDetail document={doc} data={data} close={() => setDoc(null)} run={run} /></div>
            </div>
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
                <Pos data={data} run={run} openDoc={openDoc} openStockAdjustment={openStockAdjustment} />
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
              {view === "warehouses" && (
                <Warehouses data={data} run={run} openDoc={openDoc} />
              )}{" "}
              {view === "transfers" && (
                <Transfer data={data} run={run} openDoc={openDoc} />
              )}{" "}
              {view === "adjustments" && (
                <Adjustment data={data} run={run} openDoc={openDoc} prefill={adjustmentPrefill} />
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
type SelectOption = { value: string; label: string; search?: string };
function SearchableSelect({ value, onChange, options, placeholder, searchPlaceholder, disabled = false, allowEmpty = false }: {
  value: string; onChange: (value: string) => void; options: SelectOption[];
  placeholder: string; searchPlaceholder: string; disabled?: boolean; allowEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const normalized = query.trim().toLocaleLowerCase("ar");
  const matches = options.map((option, index) => ({ option, index, text: `${option.label} ${option.search ?? ""}`.toLocaleLowerCase("ar") }))
    .filter(x => !normalized || x.text.includes(normalized))
    .sort((a, b) => {
      const score = (x: typeof a) => x.text === normalized ? 0 : x.text.startsWith(normalized) ? 1 : x.option.label.toLocaleLowerCase("ar").startsWith(normalized) ? 2 : 3;
      return score(a) - score(b) || a.index - b.index;
    }).slice(0, 20).map(x => x.option);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close);
  }, []);
  const choose = (next: string) => { onChange(next); setOpen(false); setQuery(""); setActive(0); };
  return <div className="combobox" ref={root}>
    <button type="button" className="combobox-trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(x => !x)}>
      <span>{options.find(x => x.value === value)?.label ?? placeholder}</span><ChevronDown />
    </button>
    {open && <div className="combobox-popover">
      <label className="search"><Search /><input autoFocus value={query} placeholder={searchPlaceholder} onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={e => {
        if (e.key === "Escape") setOpen(false);
        if (e.key === "ArrowDown") { e.preventDefault(); setActive(x => Math.min(x + 1, matches.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setActive(x => Math.max(x - 1, 0)); }
        if (e.key === "Enter" && matches[active]) { e.preventDefault(); choose(matches[active].value); }
      }} /></label>
      <div className="combobox-results" role="listbox">
        {allowEmpty && <button type="button" onClick={() => choose("")}>{placeholder}</button>}
        {matches.map((option, index) => <button type="button" role="option" aria-selected={option.value === value} className={index === active || option.value === value ? "active" : ""} key={option.value} onMouseEnter={() => setActive(index)} onClick={() => choose(option.value)}>{option.label}</button>)}
        {!matches.length && <div className="combobox-empty">لا توجد نتائج</div>}
      </div>
    </div>}
  </div>;
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
  const normalized = query.trim().toLocaleLowerCase("ar");
  const results = normalized
    ? data.products.map((p, index) => ({ p, index, name: p.name.toLocaleLowerCase("ar"), all: `${p.name} ${p.sku} ${p.barcode}`.toLocaleLowerCase("ar") }))
        .filter(x => x.all.includes(normalized))
        .sort((a, b) => {
          const score = (x: typeof a) => x.name === normalized ? 0 : x.name.startsWith(normalized) ? 1 : x.all.startsWith(normalized) ? 2 : 3;
          return score(a) - score(b) || a.index - b.index;
        }).slice(0, 20).map(x => x.p)
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
      {query.trim() && (
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
          {!results.length && <div className="combobox-empty">لا توجد نتائج</div>}
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
  availableStock,
}: {
  line: DraftLine;
  product: Product;
  onChange: (x: DraftLine) => void;
  onRemove: () => void;
  mode: "sale" | "purchase" | "transfer" | "adjust";
  availableStock?: number;
}) {
  const qty = val(line.quantity);
  return (
    <div className="line">
      <div className="line-title">
        <span>
          <strong>{product.name}</strong>
          <small>
            {mode === "purchase" && qty
              ? `يعادل ${quantity(qty, product.piecesPerCarton)}`
              : `المتاح: ${number(mode === "sale" ? (availableStock ?? 0) : Object.values(product.stocks).reduce((a, b) => a + b, 0))} فرد`}
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
          إجمالي المنتج: {" "}
          {money(
            saleLineTotal(qty, product.piecesPerCarton, val(line.piecePrice), 0, "piece"),
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
  openStockAdjustment,
}: {
  data: BootstrapData;
  run: RunCommand;
  openDoc: (id: string) => void;
  openStockAdjustment: (prefill: AdjustmentPrefill) => void;
}) {
  const [query, setQuery] = useState(""),
    [lines, setLines] = useSessionDraft<DraftLine[]>("sale-lines", []),
    [editingLine, setEditingLine] = useSessionDraft<DraftLine | null>("sale-editing", null),
    [payment, setPayment] = useSessionDraft("sale-payment", "cash"),
    [partyId, setPartyId] = useSessionDraft("sale-party", ""),
    [quick, setQuick] = useState(false),
    [selectedLine, setSelectedLine] = useState<string | null>(null),
    [stockError, setStockError] = useState<{ productId: string; available: number } | null>(null),
    [stockNotice, setStockNotice] = useState("");
  const wh = data.warehouses.find((w) => w.isSalesDefault),
    details = lines.flatMap((l) => {
      const p = data.products.find((x) => x.id === l.productId);
      return p
        ? [
            {
              l,
              p,
              total: saleLineTotal(val(l.quantity), p.piecesPerCarton, val(l.piecePrice), 0, "piece"),
            },
          ]
        : [];
    }),
    total = details.reduce((s, x) => s + x.total, 0);
  function add(p: Product) {
    const confirmed = lines.find((line) => line.productId === p.id);
    setEditingLine(confirmed ? { ...confirmed, pricingMode: "piece" } : lineFor(p));
    if (confirmed) setLines((current) => current.filter((line) => line.productId !== p.id));
    setStockError(null);
    setQuery("");
  }
  function editLine(line: DraftLine) {
    setLines((current) => current.filter((item) => item.productId !== line.productId));
    setEditingLine({ ...line, pricingMode: "piece" });
    setStockError(null);
  }
  function confirmLine() {
    if (!editingLine) return;
    const product = data.products.find((item) => item.id === editingLine.productId);
    const available = Number(product?.stocks?.[wh?.id ?? ""] ?? 0);
    if (!product || !wh || val(editingLine.quantity) > available) {
      setStockError({ productId: editingLine.productId, available });
      setStockNotice(`المخزون غير كافٍ. المتاح: ${number(available)}`);
      window.setTimeout(() => setStockNotice(""), 2600);
      return;
    }
    if (product.lastPurchaseCost != null && val(editingLine.piecePrice) < product.lastPurchaseCost) {
      setStockNotice(`لا يمكن البيع تحت سعر الشراء. سعر الشراء الحالي: ${number(product.lastPurchaseCost)} MRU`);
      window.setTimeout(() => setStockNotice(""), 3500);
      return;
    }
    const confirmed = { ...editingLine, pricingMode: "piece" as const };
    setLines((current) => [confirmed, ...current.filter((line) => line.productId !== confirmed.productId)]);
    setEditingLine(null);
  }
  async function submit() {
    const id = await run(
      {
        type: "sale.post",
        warehouseId: wh?.id,
        paymentMethod: payment,
        paidAmount: payment === "note" ? 0 : total,
        partyId: payment === "note" ? partyId : null,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: val(l.quantity),
          piecePrice: val(l.piecePrice),
          pricingMode: "piece",
        })),
      },
      "تم اعتماد فاتورة البيع",
    );
    setLines([]);
    setEditingLine(null);
    setPayment("cash");
    setPartyId("");
    openDoc(id);
  }
  return (
    <section>
      {stockNotice && <div className="toast stock-toast">{stockNotice}</div>}
      <div className="pos-grid">
        <div className="panel">
          <SearchProducts
            data={data}
            query={query}
            setQuery={setQuery}
            onPick={add}
          />
          <div className="invoice-lines">
            {editingLine ? (
              (() => {
                const product = data.products.find((item) => item.id === editingLine.productId);
                return product ? <div className="draft-line">
                <LineEditor
                  line={editingLine}
                  product={product}
                  mode="sale"
                  availableStock={Number(product.stocks?.[wh?.id ?? ""] ?? 0)}
                  onChange={(next) => {
                    setEditingLine(next);
                    if (stockError && val(next.quantity) <= Number(product.stocks?.[wh?.id ?? ""] ?? 0)) setStockError(null);
                  }}
                  onRemove={() => { setEditingLine(null); setStockError(null); }}
                />
                {stockError?.productId === editingLine.productId && <div className="stock-error-inline">
                  <span>المتاح في مخزن البيع: {number(stockError.available)} فرد</span>
                  {wh && <button type="button" className="soft" onClick={() => openStockAdjustment({ productId: editingLine.productId, warehouseId: wh.id })}>تصحيح المخزون</button>}
                </div>}
                <button className="primary wide confirm-line" disabled={val(editingLine.quantity) <= 0 || val(editingLine.piecePrice) < 0} onClick={confirmLine}>تأكيد وإضافة للفاتورة</button>
              </div> : null;
              })()
            ) : (
              <Empty text="ابحث عن منتج لتحريره ثم أكّد إضافته إلى الفاتورة" />
            )}
          </div>
        </div>
        <div className="panel checkout invoice-card">
          <div className="invoice-card-head">
            <h3>الفاتورة</h3>
            <div><span className="product-count">{number(lines.length)} منتج</span>{lines.length > 0 && <button className="clear-draft" onClick={() => { if (confirm("هل تريد مسح الفاتورة؟")) { setLines([]); setEditingLine(null); } }}>مسح الفاتورة</button>}</div>
          </div>

          <div className={lines.length ? "invoice-preview has-items" : "invoice-preview"}>
            {lines.length ? (
              <div className="invoice-preview-list" role="table" aria-label="منتجات الفاتورة">
                <div className="invoice-table-row invoice-table-head" role="row">
                  <span>الاسم</span><span>الكمية</span><span>السعر</span><span>المجموع</span>
                </div>
                {details.map(({ l, p, total: lineTotal }) => (
                  <div className={`invoice-preview-item invoice-table-row${selectedLine === p.id ? " selected" : ""}`} role="row" tabIndex={0} aria-selected={selectedLine === p.id} onClick={() => setSelectedLine(p.id)} key={p.id}>
                    <span className="invoice-item-name"><b>{p.name}</b><button type="button" className="invoice-item-edit" aria-label={`تعديل ${p.name}`} onClick={() => editLine(l)}><PencilLine /><span>تعديل</span></button></span>
                    <span>{quantity(val(l.quantity), p.piecesPerCarton)}</span>
                    <span dir="ltr">{money(val(l.piecePrice))}</span>
                    <strong className="invoice-item-total">{money(lineTotal)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-invoice-state">
                <span><ReceiptText /></span>
                <b>الفاتورة فارغة</b>
                <small>أضف المنتجات لبدء فاتورة جديدة</small>
              </div>
            )}
          </div>

          <div className="invoice-meta-row" aria-label="نوع الفاتورة">
            <button className={payment !== "note" ? "meta-option selected" : "meta-option"} onClick={() => setPayment("cash")}>
              <Banknote /><span><small>طريقة التحصيل</small><b>دفع مباشر</b></span>
            </button>
            <button className={payment === "note" ? "meta-option selected secondary" : "meta-option secondary"} onClick={() => setPayment("note")}>
              <PencilLine /><span><small>نوع البيع</small><b>ملاحظة</b></span>
            </button>
          </div>

          {payment !== "note" && <div className="payment-section">
            <span className="payment-label">طريقة الدفع</span>
            <div className="pay-grid">
              {paymentMethods.map((p) => (
                <PaymentMethodButton key={p.id} id={p.id} label={p.label} selected={payment === p.id} onSelect={setPayment} />
              ))}
            </div>
          </div>}
          {payment === "note" && (
            <>
              <label>
                اختيار العميل
                <SearchableSelect value={partyId} onChange={setPartyId} placeholder="اختر العميل" searchPlaceholder="ابحث باسم العميل أو رقم الهاتف" options={data.parties.map(p => ({ value: p.id, label: p.name, search: p.phone }))} />
              </label>
              <button className="link" onClick={() => setQuick(!quick)}>
                <Plus /> إضافة عميل
              </button>
              {quick && <QuickParty run={run} onDone={() => setQuick(false)} />}
            </>
          )}
          <div className="total invoice-total">
            <span>الإجمالي</span>
            <strong><small>MRU</small>{money(total).replace("MRU", "").trim()}</strong>
          </div>
          <button
            className="primary wide"
            disabled={!lines.length || !wh || (payment === "note" && !partyId)}
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
        dateFilter
      />
    </section>
  );
}

const paymentIcons = {
  cash: Banknote,
  bankily: WalletCards,
  masrvi: Building2,
  sedad: Landmark,
  bimbank: Receipt,
  note: PencilLine,
};

function PaymentMethodButton({ id, label, selected, onSelect }: {
  id: keyof typeof paymentIcons;
  label: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = paymentIcons[id];
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={selected ? "choice selected" : "choice"}
      onClick={() => onSelect(id)}
    >
      <Icon />
      <span>{label}</span>
    </button>
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
function Purchases({ data, run, openDoc }: { data: BootstrapData; run: RunCommand; openDoc: (id: string) => void }) {
  const [partyId, setPartyId] = useSessionDraft("purchase-party", "");
  const [locked, setLocked] = useSessionDraft("purchase-locked", false);
  const [warehouseId, setWarehouseId] = useSessionDraft("purchase-warehouse", "");
  const [lines, setLines] = useSessionDraft<DraftLine[]>("purchase-lines", []);
  const [editingLine, setEditingLine] = useSessionDraft<DraftLine | null>("purchase-editing", null);
  const [payment, setPayment] = useSessionDraft("purchase-payment", "cash");
  const [query, setQuery] = useState("");
  const [addingWh, setAddingWh] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const details = lines.flatMap(line => { const product = data.products.find(p => p.id === line.productId); return product ? [{ line, product }] : []; });
  const total = details.reduce((sum, item) => sum + Math.round(val(item.line.quantity) * val(item.line.unitPrice)), 0);
  function edit(line: DraftLine) { setLines(current => current.filter(item => item.productId !== line.productId)); setEditingLine(line); }
  function pick(product: Product) {
    const existing = lines.find(line => line.productId === product.id);
    if (existing) setLines(current => current.filter(line => line.productId !== product.id));
    setEditingLine(existing ?? lineFor(product)); setQuery("");
  }
  function confirmLine() {
    if (!editingLine || val(editingLine.quantity) <= 0 || val(editingLine.unitPrice) <= 0) return;
    setLines(current => [editingLine, ...current.filter(line => line.productId !== editingLine.productId)]);
    setEditingLine(null);
  }
  function clearDraft() {
    if (!confirm("هل تريد مسح فاتورة الشراء؟")) return;
    setLines([]); setEditingLine(null); setPartyId(""); setLocked(false); setWarehouseId(""); setPayment("cash");
  }
  async function submit() {
    const id = await run({ type: "purchase.post", partyId, warehouseId, paymentMethod: payment, lines: lines.map(line => ({ productId: line.productId, quantity: val(line.quantity), unitPrice: val(line.unitPrice) })) }, "تم اعتماد فاتورة الشراء");
    setLines([]); setEditingLine(null); setPartyId(""); setLocked(false); setWarehouseId(""); setPayment("cash"); openDoc(id);
  }
  return <section>
    <Heading title="فاتورة شراء جديدة" />
    <div className="purchase-grid">
      <div className="panel form-stack">
        <div className="form-row">
          <label>المورد<SearchableSelect disabled={locked} value={partyId} onChange={setPartyId} placeholder="اختر المورد" searchPlaceholder="ابحث باسم المورد أو رقم الهاتف" options={data.parties.map(p => ({ value: p.id, label: `${p.name} — ${p.phone}`, search: p.phone }))} /></label>
          <button className="soft" disabled={!partyId} onClick={() => locked ? confirm("هل تريد تغيير المورد؟ ستبقى المنتجات كما هي.") && setLocked(false) : setLocked(true)}>{locked ? "تعديل المورد" : "تأكيد المورد"}</button>
          <label>المخزن<SearchableSelect value={warehouseId} onChange={setWarehouseId} placeholder="اختر مخزن الاستلام" searchPlaceholder="ابحث عن مخزن" options={data.warehouses.map(w => ({ value: w.id, label: w.name }))} /></label>
          <button className="link" onClick={() => setAddingWh(!addingWh)}><Plus /> إضافة مخزن جديد</button>
        </div>
        {addingWh && <InlineCreate label="اسم المخزن" onSave={async name => { await run({ type: "warehouse.create", name }, "تمت إضافة المخزن"); setAddingWh(false); }} />}
        <SearchProducts data={data} query={query} setQuery={setQuery} onPick={pick} />
        <div className="invoice-lines">{editingLine ? (() => { const product = data.products.find(p => p.id === editingLine.productId); return product ? <div className="draft-line"><LineEditor line={editingLine} product={product} mode="purchase" onChange={setEditingLine} onRemove={() => setEditingLine(null)} /><button className="primary wide confirm-line" onClick={confirmLine}>تأكيد وإضافة للفاتورة</button></div> : null; })() : <Empty text="اختر منتجًا، عدّل الكمية والسعر، ثم أكّد إضافته" />}</div>
      </div>
      <div className="panel checkout invoice-card">
        <div className="invoice-card-head"><h3>فاتورة الشراء الحالية</h3><div><span className="product-count">{number(lines.length)} منتج</span>{lines.length > 0 && <button className="clear-draft" onClick={clearDraft}>مسح الفاتورة</button>}</div></div>
        <div className={lines.length ? "invoice-preview has-items" : "invoice-preview"}>{lines.length ? <div className="invoice-preview-list" role="table"><div className="invoice-table-row invoice-table-head"><span>الاسم</span><span>الكمية</span><span>السعر</span><span>المجموع</span></div>{details.map(({line, product}) => <div key={product.id} tabIndex={0} onClick={() => setSelectedLine(product.id)} className={`invoice-preview-item invoice-table-row${selectedLine === product.id ? " selected" : ""}`}><span className="invoice-item-name"><b>{product.name}</b><button className="invoice-item-edit" onClick={event => { event.stopPropagation(); edit(line); }}><PencilLine /><span>تعديل</span></button></span><span>{quantity(val(line.quantity), product.piecesPerCarton)}</span><span dir="ltr">{money(val(line.unitPrice))}</span><strong className="invoice-item-total">{money(val(line.quantity) * val(line.unitPrice))}</strong></div>)}</div> : <div className="empty-invoice-state"><span><ReceiptText /></span><b>الفاتورة فارغة</b><small>يمكن إضافة عدة منتجات قبل الاعتماد</small></div>}</div>
        <div className="invoice-meta-row"><button className={payment !== "note" ? "meta-option selected" : "meta-option"} onClick={() => setPayment("cash")}><Banknote /><span><small>نوع التسوية</small><b>دفع مباشر</b></span></button><button className={payment === "note" ? "meta-option selected secondary" : "meta-option secondary"} onClick={() => setPayment("note")}><PencilLine /><span><small>نوع التسوية</small><b>ملاحظة</b></span></button></div>
        {payment !== "note" && <div className="payment-section"><span className="payment-label">الدفع من حساب</span><div className="pay-grid">{paymentMethods.map(method => <PaymentMethodButton key={method.id} id={method.id} label={method.label} selected={payment === method.id} onSelect={setPayment} />)}</div></div>}
        {payment === "note" && <p className="note-hint">ستسجل الفاتورة كاملة دينًا علينا للمورد، دون حركة نقدية.</p>}
        <div className="total invoice-total"><span>الإجمالي</span><strong>{money(total)}</strong></div>
        <button className="primary wide" disabled={!locked || !warehouseId || !lines.length} onClick={() => void submit()}>اعتماد الفاتورة كاملة</button>
      </div>
    </div>
    <Recent title="مشتريات أخيرة" docs={data.documents.filter(d => d.kind === "purchase")} openDoc={openDoc} />
  </section>;
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
  const [title, setTitle] = useSessionDraft("expense-title", ""),
    [amount, setAmount] = useSessionDraft("expense-amount", ""),
    [date, setDate] = useSessionDraft("expense-date", new Date().toISOString().slice(0, 10)),
    [frequency, setFrequency] = useSessionDraft("expense-frequency", "once");
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
            placeholder="ابحث باسم الزبون أو المورد أو رقم الهاتف"
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
              <h3>{p.name} <span className="party-badge">زبون ومورد</span></h3>
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
    [paymentMethod, setPaymentMethod] = useState("cash"),
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
        paymentMethod,
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
              <option value="receivable">الطرف دفع لنا</option>
              <option value="payable">نحن دفعنا للطرف</option>
            </select>
          </label>
        )}
        {action === "payment" && <label>طريقة الدفع<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>}
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
          <SearchableSelect value={wh} onChange={(value) => { setWh(value); setQ(""); setRename(""); }} placeholder="اختر المخزن" searchPlaceholder="ابحث عن مخزن" options={data.warehouses.map(w => ({ value: w.id, label: w.name }))} />
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
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}>
          <div className="modal-card product-modal"><ProductForm run={run} product={editingProduct} close={() => setProductModal(false)} /></div>
        </div>
      )}
      <div className="panel">
        <Heading title="حركة المنتجات" />
        <div className="filters">
          <SearchableSelect value={moveProduct} onChange={setMoveProduct} allowEmpty placeholder="كل المنتجات" searchPlaceholder="ابحث عن منتج" options={data.products.map(p => ({ value: p.id, label: p.name, search: `${p.sku} ${p.barcode}` }))} />
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
      <div className="panel">
        <div className="section-toolbar"><Heading title="منتجات المخزن" /><button className="primary" onClick={() => { setEditingProduct(null); setProductModal(true); }}><Plus /> إضافة منتج</button></div>
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
    [pack, setPack] = useState(String(product?.piecesPerCarton ?? "")),
    [sku, setSku] = useState(product?.sku ?? ""),
    [barcode, setBarcode] = useState(product?.barcode ?? "");
  return (
    <form
      className="panel form-grid product-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const sensitive =
          product &&
          (name.trim() !== product.name || (cost === "" ? null : val(cost)) !== product.pieceCost);
        const confirmed = sensitive
          ? window.confirm(
              `أنت تغيّر بيانات أساسية للمنتج «${product.name}». هل تريد المتابعة؟`,
            )
          : true;
        if (!confirmed) return;
        await run(
          {
            type: product ? "product.update" : "product.create",
            id: product?.id,
            name,
            pieceCost: cost,
            piecePrice: price,
            piecesPerCarton: pack,
            sku,
            barcode,
            confirmSensitive: confirmed,
          },
          product ? "تم تعديل المنتج" : "تم إنشاء المنتج",
        );
        close();
      }}
    >
      <div className="product-form-head"><div><small>{product ? "بيانات المنتج" : "منتج جديد"}</small><h2>{product ? "تعديل المنتج" : "إضافة منتج جديد"}</h2></div><button type="button" className="icon" aria-label="إغلاق" onClick={close}><X /></button></div>
      <label>
        اسم المنتج
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        سعر الشراء للفرد
        <Num value={cost} onChange={setCost} />
      </label>
      <label>
        سعر البيع للفرد
        <Num value={price} onChange={setPrice} />
      </label>
      <label>
        عدد الأفراد داخل الكرتون
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
      <div className="product-form-actions"><button type="button" className="soft" onClick={close}>إلغاء</button><button className="primary">
        {product ? "حفظ التعديلات" : "حفظ المنتج"}
      </button></div>
    </form>
  );
}

function MultiStockForm({
  data,
  mode,
  run,
  openDoc,
  prefill,
}: {
  data: BootstrapData;
  mode: "transfer" | "adjust";
  run: RunCommand;
  openDoc: (id: string) => void;
  prefill?: AdjustmentPrefill | null;
}) {
  const [from, setFrom] = useSessionDraft(`${mode}-from`, prefill?.warehouseId ?? ""),
    [to, setTo] = useSessionDraft(`${mode}-to`, ""),
    [q, setQ] = useState(""),
    [reason, setReason] = useSessionDraft(`${mode}-reason`, ""),
    [lines, setLines] = useSessionDraft<DraftLine[]>(`${mode}-lines`, (() => {
      const product = data.products.find((item) => item.id === prefill?.productId);
      return product ? [lineFor(product)] : [];
    })());
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
          <SearchableSelect value={from} onChange={setFrom} placeholder="اختر المخزن" searchPlaceholder="ابحث عن مخزن" options={data.warehouses.map(w => ({ value: w.id, label: w.name }))} />
        </label>
        {mode === "transfer" && (
          <label>
            إلى
            <SearchableSelect value={to} onChange={setTo} placeholder="اختر الوجهة" searchPlaceholder="ابحث عن مخزن الوجهة" options={data.warehouses.filter(w => w.id !== from).map(w => ({ value: w.id, label: w.name }))} />
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
  prefill?: AdjustmentPrefill | null;
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
              <th>الاسم</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>المجموع</th>
            </tr>
          </thead>
          <tbody>
            {document.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.description}</td>
                <td>{quantity(l.quantity, data.products.find((product) => product.id === l.productId)?.piecesPerCarton)}</td>
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
  dateFilter = false,
}: {
  title: string;
  docs: DocumentRecord[];
  openDoc: (id: string) => void;
  dateFilter?: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const localDate = (iso: string) => {
    const date = new Date(iso);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const today = localDate(new Date().toISOString());
  const visibleDocs = dateFilter
    ? docs.filter((document) => {
        const occurredOn = localDate(document.occurredAt);
        if (!from && !to) return occurredOn === today;
        return (!from || occurredOn >= from) && (!to || occurredOn <= to);
      })
    : docs;
  return (
    <div className="panel records">
      <Heading title={title} />
      {dateFilter && <div className="filters recent-date-filters">
        <label>من تاريخ<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>إلى تاريخ<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>}
      {visibleDocs.slice(0, 100).map((d) => (
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
      {!visibleDocs.length && <Empty text="لا توجد فواتير ضمن الفترة المحددة" />}
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
