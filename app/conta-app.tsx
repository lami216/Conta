"use client";

import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Box,
  Boxes,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDollarSign,
  CreditCard,
  FileText,
  HandCoins,
  Landmark,
  Menu,
  Minus,
  PackageCheck,
  PackagePlus,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  Truck,
  UserPlus,
  Users,
  WalletCards,
  Warehouse,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, ReactNode, useMemo, useRef, useState } from "react";
import { demoCustomers, demoMovements, demoProducts, demoSales } from "./demo-data";
import {
  calculateLineTotal,
  formatMoney,
  formatNumber,
  formatQuantity,
  locationLabels,
  makeId,
  paymentMethods,
  timeLabel,
  todayLabel,
  type CartLine,
  type Customer,
  type LocationId,
  type MovementRecord,
  type PaymentMethod,
  type Product,
  type SaleRecord,
  type ToastMessage,
} from "./domain";

type ViewId =
  | "pos"
  | "receiving"
  | "inventory"
  | "transfers"
  | "customers"
  | "reports";

type DialogId =
  | "sale-receipt"
  | "new-product"
  | "new-customer"
  | "customer-payment"
  | null;

interface NavItem {
  id: ViewId;
  label: string;
  helper: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { id: "pos", label: "نقطة البيع", helper: "بيع سريع", icon: ShoppingCart },
  {
    id: "receiving",
    label: "استلام البضاعة",
    helper: "مورد أو سوق",
    icon: PackagePlus,
  },
  { id: "inventory", label: "المخزون", helper: "موقعان", icon: Boxes },
  {
    id: "transfers",
    label: "التحويلات",
    helper: "إلى البوتيك",
    icon: ArrowLeftRight,
  },
  { id: "customers", label: "الزبائن والملاحظات", helper: "كشف وسداد", icon: Users },
  { id: "reports", label: "التقارير", helper: "ملخص اليوم", icon: BarChart3 },
];

const paymentIcons: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  bankily: Smartphone,
  masrvi: Landmark,
  sedad: WalletCards,
  bimbank: CreditCard,
};

function paymentLabel(method: PaymentMethod | "credit") {
  if (method === "credit") return "ملاحظة";
  return paymentMethods.find((item) => item.id === method)?.label ?? method;
}

export default function ContaApp() {
  const [activeView, setActiveView] = useState<ViewId>("pos");
  const [menuOpen, setMenuOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [customers, setCustomers] = useState<Customer[]>(demoCustomers);
  const [sales, setSales] = useState<SaleRecord[]>(demoSales);
  const [movements, setMovements] = useState<MovementRecord[]>(demoMovements);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMode, setPaymentMode] = useState<"instant" | "credit">("instant");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [creditCustomerId, setCreditCustomerId] = useState("");
  const [dialog, setDialog] = useState<DialogId>(null);
  const [lastReceipt, setLastReceipt] = useState<SaleRecord | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const cartDetails = useMemo(
    () =>
      cart.flatMap((line) => {
        const product = products.find((item) => item.id === line.productId);
        if (!product) return [];
        return [{
          ...line,
          product,
          total: calculateLineTotal(
            product,
            line.quantityPieces,
            line.piecePrice,
            line.cartonPrice,
          ),
        }];
      }),
    [cart, products],
  );

  const cartTotal = cartDetails.reduce((sum, line) => sum + line.total, 0);
  const cartPieceCount = cart.reduce((sum, line) => sum + line.quantityPieces, 0);

  function showToast(title: string, message: string, tone: "success" | "warning" = "success") {
    setToast({ id: Date.now(), title, message, tone });
    window.setTimeout(() => setToast(null), 3400);
  }

  function navigate(view: ViewId) {
    setActiveView(view);
    setMenuOpen(false);
  }

  function addToCart(productId: string, quantityPieces = 1) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setCart((current) => {
      const existing = current.find((line) => line.productId === productId);
      const nextQuantity = (existing?.quantityPieces ?? 0) + quantityPieces;
      if (nextQuantity > product.stock.boutique) {
        showToast("الكمية غير متوفرة", `المتاح في البوتيك: ${formatQuantity(product.stock.boutique, product.piecesPerCarton)}`, "warning");
        return current;
      }
      if (existing) {
        return current.map((line) =>
          line.productId === productId ? { ...line, quantityPieces: nextQuantity } : line,
        );
      }
      return [...current, {
        productId,
        quantityPieces,
        piecePrice: product.piecePrice,
        cartonPrice: product.cartonPrice,
      }];
    });
  }

  function setCartQuantity(productId: string, quantityPieces: number) {
    if (quantityPieces <= 0) {
      setCart((current) => current.filter((line) => line.productId !== productId));
      return;
    }
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    if (quantityPieces > product.stock.boutique) {
      showToast("الكمية غير متوفرة", "لا يمكن تجاوز رصيد البوتيك الحالي.", "warning");
      return;
    }
    setCart((current) =>
      current.map((line) =>
        line.productId === productId ? { ...line, quantityPieces } : line,
      ),
    );
  }

  function setCartPrice(
    productId: string,
    priceType: "piece" | "carton",
    price: number,
  ) {
    const safePrice = Math.max(0, price || 0);
    setCart((current) =>
      current.map((line) =>
        line.productId === productId
          ? {
              ...line,
              [priceType === "piece" ? "piecePrice" : "cartonPrice"]: safePrice,
            }
          : line,
      ),
    );
  }

  function completeSale() {
    if (!cartDetails.length) {
      showToast("الفاتورة فارغة", "أضف منتجًا واحدًا على الأقل لإتمام البيع.", "warning");
      return;
    }
    if (paymentMode === "credit" && !creditCustomerId) {
      showToast("اختر الزبون", "الملاحظة يجب أن ترتبط بزبون مسجّل.", "warning");
      return;
    }

    const customer = customers.find((item) => item.id === creditCustomerId);
    const sale: SaleRecord = {
      id: `V-${1050 + sales.length}`,
      createdAt: timeLabel(),
      total: cartTotal,
      paymentMethod: paymentMode === "credit" ? "credit" : paymentMethod,
      customerName: paymentMode === "credit" ? customer?.name ?? "زبون" : "زبون نقدي",
      itemCount: cartPieceCount,
    };

    setProducts((current) =>
      current.map((product) => {
        const line = cart.find((item) => item.productId === product.id);
        if (!line) return product;
        return {
          ...product,
          stock: {
            ...product.stock,
            boutique: product.stock.boutique - line.quantityPieces,
          },
        };
      }),
    );

    if (paymentMode === "credit" && customer) {
      setCustomers((current) =>
        current.map((item) =>
          item.id === customer.id
            ? { ...item, balance: item.balance + cartTotal, lastActivity: "الآن" }
            : item,
        ),
      );
    }

    const saleMovements: MovementRecord[] = cartDetails.map((line, index) => ({
      id: `${makeId("M")}-${index}`,
      createdAt: `اليوم، ${timeLabel()}`,
      type: "sale",
      productName: line.product.name,
      quantityPieces: line.quantityPieces,
      piecesPerCarton: line.product.piecesPerCarton,
      from: "boutique",
      reference: sale.id,
      note: paymentMode === "credit" ? `ملاحظة على ${customer?.name}` : `بيع ${paymentLabel(paymentMethod)}`,
    }));

    setMovements((current) => [...saleMovements, ...current]);
    setSales((current) => [sale, ...current]);
    setLastReceipt(sale);
    setDialog("sale-receipt");
    setCart([]);
    setPaymentMode("instant");
    setPaymentMethod("cash");
    setCreditCustomerId("");
  }

  function addProduct(product: Product) {
    setProducts((current) => [product, ...current]);
    setDialog(null);
    showToast("تمت إضافة المنتج", `${product.name} جاهز للاستلام والبيع.`);
  }

  function receiveStock(input: {
    productId: string;
    supplier: string;
    destination: LocationId;
    quantityPieces: number;
  }) {
    const product = products.find((item) => item.id === input.productId);
    if (!product || input.quantityPieces <= 0) return;
    setProducts((current) =>
      current.map((item) =>
        item.id === product.id
          ? {
              ...item,
              stock: {
                ...item.stock,
                [input.destination]: item.stock[input.destination] + input.quantityPieces,
              },
            }
          : item,
      ),
    );
    const movement: MovementRecord = {
      id: makeId("M"),
      createdAt: `اليوم، ${timeLabel()}`,
      type: "receipt",
      productName: product.name,
      quantityPieces: input.quantityPieces,
      piecesPerCarton: product.piecesPerCarton,
      to: input.destination,
      reference: `REC-${String(movements.length + 34).padStart(4, "0")}`,
      note: `${input.supplier || "مورد السوق"} ← ${locationLabels[input.destination]}`,
    };
    setMovements((current) => [movement, ...current]);
    showToast("تم استلام البضاعة", `${formatQuantity(input.quantityPieces, product.piecesPerCarton)} أضيفت إلى ${locationLabels[input.destination]}.`);
  }

  function transferStock(productId: string, quantityPieces: number) {
    const product = products.find((item) => item.id === productId);
    if (!product || quantityPieces <= 0) return;
    if (quantityPieces > product.stock.warehouse) {
      showToast("رصيد المخزن غير كافٍ", `المتاح: ${formatQuantity(product.stock.warehouse, product.piecesPerCarton)}`, "warning");
      return;
    }
    setProducts((current) =>
      current.map((item) =>
        item.id === productId
          ? {
              ...item,
              stock: {
                warehouse: item.stock.warehouse - quantityPieces,
                boutique: item.stock.boutique + quantityPieces,
              },
            }
          : item,
      ),
    );
    const movement: MovementRecord = {
      id: makeId("M"),
      createdAt: `اليوم، ${timeLabel()}`,
      type: "transfer",
      productName: product.name,
      quantityPieces,
      piecesPerCarton: product.piecesPerCarton,
      from: "warehouse",
      to: "boutique",
      reference: `TR-${String(movements.length + 20).padStart(4, "0")}`,
      note: "تحويل مباشر مكتمل إلى البوتيك",
    };
    setMovements((current) => [movement, ...current]);
    showToast("اكتمل التحويل", `${formatQuantity(quantityPieces, product.piecesPerCarton)} أصبحت متاحة للبيع في البوتيك.`);
  }

  function addCustomer(customer: Customer) {
    setCustomers((current) => [customer, ...current]);
    setDialog(null);
    showToast("تمت إضافة الزبون", "يمكن الآن اختياره عند تسجيل ملاحظة.");
  }

  function recordCustomerPayment(customerId: string, amount: number, method: PaymentMethod) {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer || amount <= 0) return;
    const applied = Math.min(amount, customer.balance);
    setCustomers((current) =>
      current.map((item) =>
        item.id === customerId
          ? { ...item, balance: Math.max(0, item.balance - applied), lastActivity: "الآن" }
          : item,
      ),
    );
    setMovements((current) => [
      {
        id: makeId("M"),
        createdAt: `اليوم، ${timeLabel()}`,
        type: "customer-payment",
        reference: `PAY-${String(current.length + 10).padStart(4, "0")}`,
        note: `سداد من ${customer.name} عبر ${paymentLabel(method)} — ${formatMoney(applied)}`,
      },
      ...current,
    ]);
    setDialog(null);
    showToast("تم تسجيل السداد", `خُصم ${formatMoney(applied)} من رصيد ${customer.name}.`);
  }

  const activeItem = navItems.find((item) => item.id === activeView) ?? navItems[0];

  return (
    <div className="app-shell" dir="rtl">
      <button
        className={`mobile-backdrop ${menuOpen ? "is-visible" : ""}`}
        aria-label="إغلاق القائمة"
        onClick={() => setMenuOpen(false)}
      />
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">C</div>
          <div>
            <strong>Conta</strong>
            <span>نظام المتجر</span>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>

        <div className="branch-card">
          <span className="branch-icon"><Warehouse size={20} /></span>
          <div>
            <small>الموقع النشط</small>
            <strong>البوتيك الرئيسي</strong>
          </div>
          <ChevronDown size={17} />
        </div>

        <nav className="main-nav" aria-label="القائمة الرئيسية">
          <p className="nav-caption">العمليات</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activeView === item.id ? "is-active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <span className="nav-icon"><Icon size={20} strokeWidth={1.9} /></span>
                <span className="nav-copy">
                  <strong>{item.label}</strong>
                  <small>{item.helper}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="sync-card">
            <span className="status-dot" />
            <div>
              <strong>متصل وآمن</strong>
              <small>آخر مزامنة الآن</small>
            </div>
            <Wifi size={17} />
          </div>
          <div className="owner-card">
            <div className="owner-avatar">م</div>
            <div>
              <strong>المالك</strong>
              <small>صلاحيات كاملة</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة">
              <Menu size={22} />
            </button>
            <div>
              <span className="eyebrow">Conta · البوتيك الرئيسي</span>
              <h1>{activeItem.label}</h1>
            </div>
          </div>
          <div className="topbar-meta">
            <span className="demo-chip"><CircleAlert size={15} /> بيانات تجريبية</span>
            <span className="date-chip"><CalendarDays size={16} /> {todayLabel()}</span>
          </div>
        </header>

        <div className="view-container">
          {activeView === "pos" && (
            <PosView
              products={products}
              customers={customers}
              cart={cartDetails}
              cartTotal={cartTotal}
              paymentMode={paymentMode}
              paymentMethod={paymentMethod}
              creditCustomerId={creditCustomerId}
              onAdd={addToCart}
              onSetQuantity={setCartQuantity}
              onSetPrice={setCartPrice}
              onPaymentMode={setPaymentMode}
              onPaymentMethod={setPaymentMethod}
              onCustomer={setCreditCustomerId}
              onComplete={completeSale}
              onClear={() => setCart([])}
            />
          )}
          {activeView === "receiving" && (
            <ReceivingView
              products={products}
              movements={movements}
              onReceive={receiveStock}
              onNewProduct={() => setDialog("new-product")}
            />
          )}
          {activeView === "inventory" && (
            <InventoryView
              products={products}
              movements={movements}
              onNewProduct={() => setDialog("new-product")}
            />
          )}
          {activeView === "transfers" && (
            <TransfersView products={products} movements={movements} onTransfer={transferStock} />
          )}
          {activeView === "customers" && (
            <CustomersView
              customers={customers}
              onNewCustomer={() => setDialog("new-customer")}
              onPayment={(id) => {
                setSelectedCustomerId(id);
                setDialog("customer-payment");
              }}
            />
          )}
          {activeView === "reports" && (
            <ReportsView products={products} sales={sales} customers={customers} />
          )}
        </div>
      </main>

      {dialog === "sale-receipt" && lastReceipt && (
        <Modal title="اكتملت عملية البيع" onClose={() => setDialog(null)} size="small">
          <div className="success-receipt">
            <div className="success-icon"><Check size={30} /></div>
            <p>تم تسجيل الفاتورة بنجاح</p>
            <strong>{formatMoney(lastReceipt.total)}</strong>
            <div className="receipt-summary">
              <span><small>رقم الفاتورة</small><b>{lastReceipt.id}</b></span>
              <span><small>طريقة الدفع</small><b>{paymentLabel(lastReceipt.paymentMethod)}</b></span>
              <span><small>الزبون</small><b>{lastReceipt.customerName}</b></span>
            </div>
            <div className="modal-actions two-actions">
              <button className="secondary-button" onClick={() => window.print()}><Printer size={18} /> طباعة</button>
              <button className="primary-button" onClick={() => setDialog(null)}>بيع جديد</button>
            </div>
          </div>
        </Modal>
      )}

      {dialog === "new-product" && (
        <Modal title="إضافة منتج جديد" onClose={() => setDialog(null)}>
          <NewProductForm onSubmit={addProduct} />
        </Modal>
      )}

      {dialog === "new-customer" && (
        <Modal title="إضافة زبون للملاحظات" onClose={() => setDialog(null)} size="small">
          <NewCustomerForm onSubmit={addCustomer} />
        </Modal>
      )}

      {dialog === "customer-payment" && (
        <Modal title="تسجيل سداد" onClose={() => setDialog(null)} size="small">
          <CustomerPaymentForm
            customer={customers.find((item) => item.id === selectedCustomerId)}
            onSubmit={recordCustomerPayment}
          />
        </Modal>
      )}

      {toast && (
        <div className={`toast ${toast.tone === "warning" ? "is-warning" : ""}`} role="status">
          <span>{toast.tone === "warning" ? <CircleAlert size={20} /> : <CheckCircle2 size={20} />}</span>
          <div><strong>{toast.title}</strong><p>{toast.message}</p></div>
        </div>
      )}
    </div>
  );
}

function normalizeProductText(value: string) {
  return value
    .toLocaleLowerCase("ar")
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function productSearchScore(product: Product, query: string) {
  const name = normalizeProductText(product.name);
  const reference = normalizeProductText(`${product.sku} ${product.barcode}`);
  if (name === query || reference === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2 + name.indexOf(query) / 100;
  if (reference.includes(query)) return 3;

  const words = name.split(" ");
  const closest = Math.min(...words.map((word) => editDistance(word, query)));
  const threshold = query.length <= 3 ? 1 : Math.max(2, Math.floor(query.length * 0.34));
  return closest <= threshold ? 5 + closest : Number.POSITIVE_INFINITY;
}

function PosView({
  products,
  customers,
  cart,
  cartTotal,
  paymentMode,
  paymentMethod,
  creditCustomerId,
  onAdd,
  onSetQuantity,
  onSetPrice,
  onPaymentMode,
  onPaymentMethod,
  onCustomer,
  onComplete,
  onClear,
}: {
  products: Product[];
  customers: Customer[];
  cart: Array<CartLine & { product: Product; total: number }>;
  cartTotal: number;
  paymentMode: "instant" | "credit";
  paymentMethod: PaymentMethod;
  creditCustomerId: string;
  onAdd: (productId: string, quantity?: number) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onSetPrice: (productId: string, priceType: "piece" | "carton", price: number) => void;
  onPaymentMode: (mode: "instant" | "credit") => void;
  onPaymentMethod: (method: PaymentMethod) => void;
  onCustomer: (customerId: string) => void;
  onComplete: () => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const normalizedQuery = normalizeProductText(query);
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return products
      .filter((product) => product.stock.boutique > 0)
      .map((product) => ({ product, score: productSearchScore(product, normalizedQuery) }))
      .filter((result) => Number.isFinite(result.score))
      .sort((left, right) => left.score - right.score || left.product.name.localeCompare(right.product.name, "ar"))
      .slice(0, 8)
      .map((result) => result.product);
  }, [normalizedQuery, products]);

  function selectProduct(productId: string) {
    onAdd(productId);
    setQuery("");
    window.setTimeout(() => searchInput.current?.focus(), 0);
  }

  return (
    <div className="pos-layout">
      <section className="product-search-panel panel">
        <div className="pos-search-box">
          <Search size={22} />
          <input
            ref={searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchResults[0]) selectProduct(searchResults[0].id);
            }}
            placeholder="ابحث عن منتج بالاسم أو الباركود"
            aria-label="البحث عن منتج"
            autoFocus
          />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="مسح البحث"><X size={18} /></button>}
        </div>

        {normalizedQuery && (
          <div className="product-search-results" role="listbox" aria-label="نتائج البحث">
            {searchResults.map((product) => (
              <button
                type="button"
                className="product-search-result"
                key={product.id}
                onClick={() => selectProduct(product.id)}
              >
                <span className="search-result-mark" style={{ background: `${product.accent}18`, color: product.accent }}>
                  {product.name.slice(0, 1)}
                </span>
                <span className="search-result-name">
                  <strong>{product.name}</strong>
                  <span>المتاح {formatQuantity(product.stock.boutique, product.piecesPerCarton)}</span>
                </span>
                <span className="search-result-price">{formatMoney(product.piecePrice)}</span>
                <Plus size={19} />
              </button>
            ))}
            {!searchResults.length && <div className="no-search-result">لا يوجد منتج مطابق</div>}
          </div>
        )}
      </section>

      <aside className="checkout-panel panel">
        <div className="checkout-head">
          <h2>الفاتورة</h2>
          <span className="cart-count">{formatNumber(cart.length)}</span>
        </div>

        <div className="invoice-lines">
          {cart.length ? cart.map((line) => {
            return (
              <article className="invoice-line" key={line.productId}>
                <div className="invoice-line-head">
                  <div>
                    <strong>{line.product.name}</strong>
                    <span>{formatQuantity(line.quantityPieces, line.product.piecesPerCarton)}</span>
                  </div>
                  <button className="remove-line" onClick={() => onSetQuantity(line.productId, 0)} aria-label={`حذف ${line.product.name}`}><Trash2 size={17} /></button>
                </div>

                <div className="invoice-line-actions">
                  <div className="quantity-control">
                    <button onClick={() => onSetQuantity(line.productId, line.quantityPieces - 1)} aria-label="إنقاص فرد"><Minus size={16} /></button>
                    <b>{formatNumber(line.quantityPieces)}</b>
                    <button onClick={() => onSetQuantity(line.productId, line.quantityPieces + 1)} aria-label="إضافة فرد"><Plus size={16} /></button>
                  </div>
                  <button className="pack-shortcut" onClick={() => onSetQuantity(line.productId, line.quantityPieces + line.product.piecesPerCarton)}>كرتون +</button>
                  <strong className="invoice-line-total">{formatMoney(line.total)}</strong>
                </div>

                <div className="line-price-fields">
                  <label>
                    <span>سعر الفرد</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={line.piecePrice}
                      onChange={(event) => onSetPrice(line.productId, "piece", Number(event.target.value))}
                    />
                    <b>MRU</b>
                  </label>
                  <label>
                    <span>سعر الكرتون</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={line.cartonPrice}
                      onChange={(event) => onSetPrice(line.productId, "carton", Number(event.target.value))}
                    />
                    <b>MRU</b>
                  </label>
                </div>
              </article>
            );
          }) : (
            <div className="empty-invoice">
              <ReceiptText size={30} />
              <strong>الفاتورة فارغة</strong>
            </div>
          )}
        </div>

        <div className="checkout-payment">
          <div className="payment-mode-switch">
            <button className={paymentMode === "instant" ? "is-active" : ""} onClick={() => onPaymentMode("instant")}><Banknote size={17} /> دفع مباشر</button>
            <button className={paymentMode === "credit" ? "is-active" : ""} onClick={() => onPaymentMode("credit")}><FileText size={17} /> ملاحظة</button>
          </div>

          {paymentMode === "instant" ? (
            <div className="payment-methods">
              {paymentMethods.map((method) => {
                const Icon = paymentIcons[method.id];
                return <button key={method.id} className={paymentMethod === method.id ? "is-active" : ""} onClick={() => onPaymentMethod(method.id)}><Icon size={17} />{method.shortLabel}</button>;
              })}
            </div>
          ) : (
            <label className="customer-select-label">
              <span>الزبون</span>
              <select value={creditCustomerId} onChange={(event) => onCustomer(event.target.value)}>
                <option value="">اختر زبونًا</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} — {formatMoney(customer.balance)}</option>)}
              </select>
            </label>
          )}

          <div className="checkout-total">
            <span>الإجمالي</span>
            <strong>{formatMoney(cartTotal)}</strong>
          </div>
          <button className="complete-sale" onClick={onComplete}><CheckCircle2 size={21} /> إتمام البيع</button>
          {cart.length > 0 && <button className="clear-cart" onClick={onClear}><RotateCcw size={15} /> تفريغ الفاتورة</button>}
        </div>
      </aside>
    </div>
  );
}

function ReceivingView({
  products,
  movements,
  onReceive,
  onNewProduct,
}: {
  products: Product[];
  movements: MovementRecord[];
  onReceive: (input: { productId: string; supplier: string; destination: LocationId; quantityPieces: number }) => void;
  onNewProduct: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [supplier, setSupplier] = useState("");
  const [destination, setDestination] = useState<LocationId>("warehouse");
  const [cartons, setCartons] = useState("1");
  const [pieces, setPieces] = useState("0");
  const product = products.find((item) => item.id === productId) ?? products[0];
  const quantityPieces = (Number(cartons) || 0) * (product?.piecesPerCarton ?? 1) + (Number(pieces) || 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!product || quantityPieces <= 0) return;
    onReceive({ productId: product.id, supplier, destination, quantityPieces });
    setCartons("1");
    setPieces("0");
  }

  const receipts = movements.filter((movement) => movement.type === "receipt").slice(0, 6);

  return (
    <div className="page-grid receiving-layout">
      <section className="panel form-panel">
        <div className="panel-heading">
          <div><span className="section-kicker">إدخال مباشر</span><h2>استلام بضاعة</h2><p>اختر وجهة البضاعة عند وصولها؛ المخزن الرئيسي أو البوتيك مباشرة.</p></div>
          <button className="secondary-button" onClick={onNewProduct}><Plus size={17} /> منتج جديد</button>
        </div>
        <form className="business-form" onSubmit={submit}>
          <div className="destination-picker">
            <button type="button" className={destination === "warehouse" ? "is-active" : ""} onClick={() => setDestination("warehouse")}><Warehouse size={23} /><span><strong>المخزن الرئيسي</strong><small>الشحنات والحاويات</small></span><CheckCircle2 size={18} /></button>
            <button type="button" className={destination === "boutique" ? "is-active" : ""} onClick={() => setDestination("boutique")}><ShoppingCart size={23} /><span><strong>البوتيك مباشرة</strong><small>شراء من شخص في السوق</small></span><CheckCircle2 size={18} /></button>
          </div>
          <div className="form-grid two-columns">
            <label><span>المورد أو الشخص في السوق</span><input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="مثال: مورد السلام أو أحمد السوق" /></label>
            <label><span>المنتج</span><select value={productId} onChange={(event) => setProductId(event.target.value)}>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
          <div className="quantity-entry">
            <label><span>عدد الكراتين</span><input type="number" min="0" value={cartons} onChange={(event) => setCartons(event.target.value)} /></label>
            <span className="math-sign">×</span>
            <div className="pack-info"><strong>{product?.piecesPerCarton ?? 0}</strong><span>فرد في الكرتون</span></div>
            <span className="math-sign">+</span>
            <label><span>أفراد إضافية</span><input type="number" min="0" value={pieces} onChange={(event) => setPieces(event.target.value)} /></label>
            <div className="quantity-result"><span>إجمالي الداخل</span><strong>{quantityPieces} فرد</strong></div>
          </div>
          <div className="form-submit-row">
            <div><CircleAlert size={17} /><span>سيضاف الرصيد فورًا إلى {locationLabels[destination]}.</span></div>
            <button className="primary-button" type="submit"><PackageCheck size={18} /> تسجيل الاستلام</button>
          </div>
        </form>
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading compact"><div><span className="section-kicker">آخر العمليات</span><h2>الاستلامات الأخيرة</h2></div><ReceiptText size={22} /></div>
        <div className="activity-list">
          {receipts.map((movement) => <MovementItem key={movement.id} movement={movement} />)}
        </div>
      </section>
    </div>
  );
}

function InventoryView({ products, movements, onNewProduct }: { products: Product[]; movements: MovementRecord[]; onNewProduct: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase()));
  const warehousePieces = products.reduce((sum, item) => sum + item.stock.warehouse, 0);
  const boutiquePieces = products.reduce((sum, item) => sum + item.stock.boutique, 0);

  return (
    <div className="stack-layout">
      <div className="stats-row three-stats">
        <StatCard icon={Warehouse} label="رصيد المخزن" value={`${warehousePieces} فرد`} helper={`${products.length} منتجات`} tone="blue" />
        <StatCard icon={ShoppingCart} label="رصيد البوتيك" value={`${boutiquePieces} فرد`} helper="متاح للبيع الآن" tone="green" />
        <StatCard icon={CircleDollarSign} label="قيمة المخزون" value={formatMoney(products.reduce((sum, item) => sum + (item.stock.warehouse + item.stock.boutique) * item.pieceCost, 0))} helper="بسعر التكلفة" tone="amber" />
      </div>
      <section className="panel table-panel">
        <div className="panel-heading table-heading">
          <div><span className="section-kicker">الأرصدة الحالية</span><h2>المنتجات والمواقع</h2></div>
          <div className="heading-actions"><div className="small-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث عن منتج" /></div><button className="primary-button" onClick={onNewProduct}><Plus size={17} /> إضافة منتج</button></div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>المنتج</th><th>حجم الكرتون</th><th>المخزن الرئيسي</th><th>البوتيك</th><th>سعر الفرد</th><th>سعر الكرتون</th></tr></thead>
            <tbody>{filtered.map((product) => <tr key={product.id}><td><div className="table-product"><span style={{ background: `${product.accent}18`, color: product.accent }}>{product.name.slice(0, 1)}</span><div><strong>{product.name}</strong><small>{product.sku}</small></div></div></td><td>{product.piecesPerCarton} فرد</td><td><strong>{formatQuantity(product.stock.warehouse, product.piecesPerCarton)}</strong></td><td><strong>{formatQuantity(product.stock.boutique, product.piecesPerCarton)}</strong></td><td>{formatMoney(product.piecePrice)}</td><td>{formatMoney(product.cartonPrice)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="panel movement-panel">
        <div className="panel-heading compact"><div><span className="section-kicker">قابل للتتبع</span><h2>سجل حركة المخزون</h2></div><FileText size={22} /></div>
        <div className="movement-grid">{movements.filter((item) => item.productName).slice(0, 8).map((movement) => <MovementItem key={movement.id} movement={movement} />)}</div>
      </section>
    </div>
  );
}

function TransfersView({ products, movements, onTransfer }: { products: Product[]; movements: MovementRecord[]; onTransfer: (productId: string, quantityPieces: number) => void }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [cartons, setCartons] = useState("1");
  const [pieces, setPieces] = useState("0");
  const product = products.find((item) => item.id === productId) ?? products[0];
  const quantityPieces = (Number(cartons) || 0) * (product?.piecesPerCarton ?? 1) + (Number(pieces) || 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!product) return;
    onTransfer(product.id, quantityPieces);
  }

  const transfers = movements.filter((movement) => movement.type === "transfer").slice(0, 8);
  return (
    <div className="page-grid transfer-layout">
      <section className="panel form-panel transfer-form-panel">
        <div className="panel-heading"><div><span className="section-kicker">حركة داخلية</span><h2>تحويل إلى البوتيك</h2><p>التحويل يغيّر مكان المخزون فقط ولا يُسجّل كمبيعة أو ربح.</p></div><ArrowLeftRight size={25} /></div>
        <div className="route-visual"><div><Warehouse size={24} /><span>المخزن الرئيسي</span></div><span className="route-line"><i /><Truck size={25} /><i /></span><div><ShoppingCart size={24} /><span>البوتيك</span></div></div>
        <form className="business-form" onSubmit={submit}>
          <label><span>المنتج</span><select value={productId} onChange={(event) => setProductId(event.target.value)}>{products.map((item) => <option key={item.id} value={item.id}>{item.name} — متاح {formatQuantity(item.stock.warehouse, item.piecesPerCarton)}</option>)}</select></label>
          <div className="form-grid two-columns">
            <label><span>عدد الكراتين</span><input type="number" min="0" value={cartons} onChange={(event) => setCartons(event.target.value)} /></label>
            <label><span>أفراد إضافية</span><input type="number" min="0" value={pieces} onChange={(event) => setPieces(event.target.value)} /></label>
          </div>
          <div className="transfer-summary"><div><span>الكمية المطلوبة</span><strong>{product ? formatQuantity(quantityPieces, product.piecesPerCarton) : "—"}</strong></div><div><span>بعد التحويل في البوتيك</span><strong>{product ? formatQuantity(product.stock.boutique + quantityPieces, product.piecesPerCarton) : "—"}</strong></div></div>
          <button className="primary-button full-button" type="submit"><ArrowLeftRight size={18} /> تنفيذ التحويل</button>
        </form>
      </section>
      <section className="panel activity-panel">
        <div className="panel-heading compact"><div><span className="section-kicker">السجل</span><h2>التحويلات الأخيرة</h2></div><Box size={22} /></div>
        <div className="activity-list">{transfers.length ? transfers.map((movement) => <MovementItem key={movement.id} movement={movement} />) : <EmptyState icon={ArrowLeftRight} title="لا توجد تحويلات" text="ستظهر التحويلات المكتملة هنا." />}</div>
      </section>
    </div>
  );
}

function CustomersView({ customers, onNewCustomer, onPayment }: { customers: Customer[]; onNewCustomer: () => void; onPayment: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = customers.filter((customer) => `${customer.name} ${customer.phone}`.toLowerCase().includes(query.toLowerCase()));
  const totalDebt = customers.reduce((sum, customer) => sum + customer.balance, 0);
  return (
    <div className="stack-layout">
      <div className="stats-row three-stats">
        <StatCard icon={HandCoins} label="إجمالي الملاحظات" value={formatMoney(totalDebt)} helper={`${formatNumber(customers.filter((item) => item.balance > 0).length)} زبائن عليهم رصيد`} tone="rose" />
        <StatCard icon={Users} label="الزبائن المسجلون" value={formatNumber(customers.length)} helper="متاحون للملاحظات" tone="blue" />
        <StatCard icon={CheckCircle2} label="أرصدة مسددة" value={formatNumber(customers.filter((item) => item.balance === 0).length)} helper="لا توجد ملاحظات عليهم" tone="green" />
      </div>
      <section className="panel table-panel">
        <div className="panel-heading table-heading"><div><span className="section-kicker">حسابات الزبائن</span><h2>الزبائن والملاحظات</h2></div><div className="heading-actions"><div className="small-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="الاسم أو الهاتف" /></div><button className="primary-button" onClick={onNewCustomer}><UserPlus size={17} /> زبون جديد</button></div></div>
        <div className="customer-cards">
          {filtered.map((customer) => <article className="customer-card" key={customer.id}><div className="customer-card-top"><span className="customer-avatar">{customer.name.slice(0, 1)}</span><div><strong>{customer.name}</strong><small>{customer.phone}</small></div><span className={`debt-badge ${customer.balance === 0 ? "is-clear" : ""}`}>{customer.balance === 0 ? "مسدد" : "عليه ملاحظة"}</span></div><div className="customer-balance"><span>الرصيد الحالي</span><strong>{formatMoney(customer.balance)}</strong><small>آخر حركة: {customer.lastActivity}</small></div><div className="customer-actions"><button className="secondary-button"><FileText size={16} /> كشف الحساب</button><button className="primary-button" disabled={customer.balance === 0} onClick={() => onPayment(customer.id)}><HandCoins size={16} /> تسجيل سداد</button></div></article>)}
        </div>
      </section>
    </div>
  );
}

function ReportsView({ products, sales, customers }: { products: Product[]; sales: SaleRecord[]; customers: Customer[] }) {
  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const cashSales = sales.filter((sale) => sale.paymentMethod === "cash").reduce((sum, sale) => sum + sale.total, 0);
  const digitalSales = sales.filter((sale) => !["cash", "credit"].includes(sale.paymentMethod)).reduce((sum, sale) => sum + sale.total, 0);
  const creditSales = sales.filter((sale) => sale.paymentMethod === "credit").reduce((sum, sale) => sum + sale.total, 0);
  const totalDebt = customers.reduce((sum, customer) => sum + customer.balance, 0);
  const maxMethod = Math.max(cashSales, digitalSales, creditSales, 1);
  return (
    <div className="stack-layout">
      <div className="stats-row four-stats">
        <StatCard icon={CircleDollarSign} label="مبيعات اليوم" value={formatMoney(totalSales)} helper={`${sales.length} فواتير`} tone="green" />
        <StatCard icon={Banknote} label="المبيعات النقدية" value={formatMoney(cashSales)} helper="الخيار الأساسي" tone="blue" />
        <StatCard icon={Smartphone} label="دفع إلكتروني" value={formatMoney(digitalSales)} helper="بنكيلي ومصرفي وغيرها" tone="violet" />
        <StatCard icon={HandCoins} label="الملاحظات القائمة" value={formatMoney(totalDebt)} helper="كل الزبائن" tone="rose" />
      </div>
      <div className="reports-grid">
        <section className="panel report-card">
          <div className="panel-heading compact"><div><span className="section-kicker">توزيع التحصيل</span><h2>المبيعات حسب الدفع</h2></div><BarChart3 size={22} /></div>
          <div className="bar-chart">
            {[{ label: "نقدي", value: cashSales, color: "var(--green)" }, { label: "إلكتروني", value: digitalSales, color: "var(--blue)" }, { label: "ملاحظة", value: creditSales, color: "var(--amber)" }].map((bar) => <div className="bar-row" key={bar.label}><span>{bar.label}</span><div><i style={{ width: `${Math.max(6, (bar.value / maxMethod) * 100)}%`, background: bar.color }} /></div><strong>{formatMoney(bar.value)}</strong></div>)}
          </div>
        </section>
        <section className="panel report-card">
          <div className="panel-heading compact"><div><span className="section-kicker">المخزون</span><h2>القيمة حسب الموقع</h2></div><Boxes size={22} /></div>
          <div className="location-values"><div><span className="value-icon blue"><Warehouse size={22} /></span><span><small>المخزن الرئيسي</small><strong>{formatMoney(products.reduce((sum, item) => sum + item.stock.warehouse * item.pieceCost, 0))}</strong></span></div><div><span className="value-icon green"><ShoppingCart size={22} /></span><span><small>البوتيك</small><strong>{formatMoney(products.reduce((sum, item) => sum + item.stock.boutique * item.pieceCost, 0))}</strong></span></div></div>
        </section>
      </div>
      <section className="panel table-panel">
        <div className="panel-heading compact"><div><span className="section-kicker">اليوم</span><h2>آخر الفواتير</h2></div><ReceiptText size={22} /></div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>الفاتورة</th><th>الوقت</th><th>الزبون</th><th>طريقة الدفع</th><th>العدد</th><th>الإجمالي</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><strong>{sale.id}</strong></td><td>{sale.createdAt}</td><td>{sale.customerName}</td><td><span className={`method-badge method-${sale.paymentMethod}`}>{paymentLabel(sale.paymentMethod)}</span></td><td>{sale.itemCount} فرد</td><td><strong>{formatMoney(sale.total)}</strong></td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

function MovementItem({ movement }: { movement: MovementRecord }) {
  const Icon = movement.type === "receipt" ? PackagePlus : movement.type === "transfer" ? ArrowLeftRight : movement.type === "sale" ? ShoppingCart : HandCoins;
  return (
    <article className="movement-item">
      <span className={`movement-icon type-${movement.type}`}><Icon size={18} /></span>
      <div className="movement-copy"><strong>{movement.productName ?? movement.note}</strong><p>{movement.productName ? movement.note : movement.reference}</p><small>{movement.createdAt}</small></div>
      <div className="movement-value">{movement.quantityPieces && movement.piecesPerCarton ? <strong>{formatQuantity(movement.quantityPieces, movement.piecesPerCarton)}</strong> : <strong>سداد</strong>}<span>{movement.reference}</span></div>
    </article>
  );
}

function StatCard({ icon: Icon, label, value, helper, tone }: { icon: LucideIcon; label: string; value: string; helper: string; tone: string }) {
  return <article className={`stat-card tone-${tone}`}><span className="stat-icon"><Icon size={22} /></span><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>;
}

function Modal({ title, children, onClose, size = "normal" }: { title: string; children: ReactNode; onClose: () => void; size?: "normal" | "small" }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}><button className="modal-backdrop" onClick={onClose} aria-label="إغلاق" /><section className={`modal-card modal-${size}`}><header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={20} /></button></header><div className="modal-body">{children}</div></section></div>;
}

function NewProductForm({ onSubmit }: { onSubmit: (product: Product) => void }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [packSize, setPackSize] = useState("12");
  const [cost, setCost] = useState("");
  const [piecePrice, setPiecePrice] = useState("");
  const [cartonPrice, setCartonPrice] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const piecesPerCarton = Math.max(1, Number(packSize) || 1);
    const unitPrice = Number(piecePrice) || 0;
    if (!name.trim() || unitPrice <= 0) return;
    onSubmit({
      id: makeId("P"),
      name: name.trim(),
      sku: sku.trim() || `SKU-${Date.now().toString().slice(-5)}`,
      barcode: barcode.trim(),
      piecesPerCarton,
      pieceCost: Number(cost) || 0,
      piecePrice: unitPrice,
      cartonPrice: Number(cartonPrice) || unitPrice * piecesPerCarton,
      stock: { warehouse: 0, boutique: 0 },
      accent: "#0f766e",
    });
  }

  return (
    <form className="business-form" onSubmit={submit}>
      <div className="form-grid three-columns">
        <label><span>اسم المنتج *</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: ماء معدني 1.5 لتر" required /></label>
        <label><span>رمز المنتج</span><input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="ينشأ تلقائيًا" /></label>
        <label><span>الباركود</span><input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="امسح أو اكتب الباركود" /></label>
      </div>
      <div className="form-section-title"><Box size={17} /><span>الوحدات والأسعار</span></div>
      <div className="form-grid four-columns">
        <label><span>الفرد في الكرتون *</span><input type="number" min="1" value={packSize} onChange={(event) => setPackSize(event.target.value)} required /></label>
        <label><span>تكلفة الفرد</span><input type="number" min="0" value={cost} onChange={(event) => setCost(event.target.value)} /></label>
        <label><span>سعر بيع الفرد *</span><input type="number" min="1" value={piecePrice} onChange={(event) => setPiecePrice(event.target.value)} required /></label>
        <label><span>سعر بيع الكرتون</span><input type="number" min="0" value={cartonPrice} onChange={(event) => setCartonPrice(event.target.value)} placeholder="يحسب تلقائيًا" /></label>
      </div>
      <div className="modal-actions"><button type="submit" className="primary-button"><Plus size={18} /> إضافة المنتج</button></div>
    </form>
  );
}

function NewCustomerForm({ onSubmit }: { onSubmit: (customer: Customer) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  function submit(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; onSubmit({ id: makeId("C"), name: name.trim(), phone: phone.trim(), balance: Number(openingBalance) || 0, creditLimit: null, lastActivity: "الآن" }); }
  return <form className="business-form" onSubmit={submit}><label><span>اسم الزبون *</span><input value={name} onChange={(event) => setName(event.target.value)} required placeholder="الاسم الكامل أو اسم المتجر" /></label><label><span>رقم الهاتف</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="مثال: 22 00 00 00" /></label><label><span>رصيد افتتاحي عليه</span><input type="number" min="0" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} /></label><div className="modal-actions"><button className="primary-button" type="submit"><UserPlus size={18} /> حفظ الزبون</button></div></form>;
}

function CustomerPaymentForm({ customer, onSubmit }: { customer?: Customer; onSubmit: (customerId: string, amount: number, method: PaymentMethod) => void }) {
  const [amount, setAmount] = useState(customer ? String(customer.balance) : "");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  if (!customer) return <EmptyState icon={CircleAlert} title="الزبون غير موجود" text="أغلق النافذة وحاول مجددًا." />;
  return <form className="business-form" onSubmit={(event) => { event.preventDefault(); onSubmit(customer.id, Number(amount), method); }}><div className="payment-customer-summary"><span className="customer-avatar">{customer.name.slice(0, 1)}</span><div><strong>{customer.name}</strong><span>الرصيد الحالي: {formatMoney(customer.balance)}</span></div></div><label><span>المبلغ المسدد</span><input type="number" min="1" max={customer.balance} value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><div className="payment-methods modal-payment-methods">{paymentMethods.map((item) => { const Icon = paymentIcons[item.id]; return <button type="button" key={item.id} className={method === item.id ? "is-active" : ""} onClick={() => setMethod(item.id)}><Icon size={17} />{item.shortLabel}</button>; })}</div><div className="modal-actions"><button type="submit" className="primary-button"><HandCoins size={18} /> تسجيل السداد</button></div></form>;
}

function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="empty-state"><Icon size={28} /><strong>{title}</strong><span>{text}</span></div>;
}
