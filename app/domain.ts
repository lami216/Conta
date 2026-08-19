export type PaymentMethod =
  | "cash"
  | "bankily"
  | "masrvi"
  | "sedad"
  | "bimbank"
  | "note";
export type DocumentKind =
  | "purchase"
  | "sale"
  | "return"
  | "transfer"
  | "adjustment"
  | "expense"
  | "payment"
  | "offset"
  | "settlement";
export interface Party {
  id: string;
  name: string;
  phone: string;
  receivable: number;
  payable: number;
  net: number;
}
export interface Warehouse {
  id: string;
  name: string;
  isSalesDefault: boolean;
}
export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  pieceCost: number | null;
  /** Cost from the newest posted purchase; manual pieceCost is never authoritative. */
  lastPurchaseCost?: number | null;
  lastPurchaseAt?: string | null;
  piecePrice: number | null;
  cartonPrice: number | null;
  piecesPerCarton?: number | null;
  stocks: Record<string, number>;
}
export interface DocumentLine {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
export interface DocumentRecord {
  id: string;
  number: string;
  kind: DocumentKind;
  partyId: string | null;
  partyName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  destinationWarehouseId: string | null;
  destinationWarehouseName: string | null;
  parentDocumentId: string | null;
  paymentMethod: string | null;
  status: string;
  title: string | null;
  total: number;
  dueTotal: number;
  paidTotal: number;
  occurredAt: string;
  businessDate?: string;
  dailySequence?: number;
  recurringId?: string;
  lines: DocumentLine[];
}
export interface Movement {
  id: string;
  documentId: string;
  documentNumber: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  type: string;
  quantityDelta: number;
  balanceBefore: number;
  balanceAfter: number;
  occurredAt: string;
}
export interface BootstrapData {
  /** Informational only; product.create allocates the authoritative value atomically. */
  nextProductCode: number;
  parties: Party[];
  warehouses: Warehouse[];
  products: Product[];
  documents: DocumentRecord[];
  movements: Movement[];
  financialMovements: FinancialMovement[];
  paymentAccounts: PaymentAccount[];
  recurringExpenses: Array<{
    id: string;
    title: string;
    amount: number;
    frequency: "daily" | "monthly";
    startsOn: string;
    active: boolean;
    currentOccurrenceKey: string;
    currentDueDate: string;
    currentPaymentMethodId: string | null;
  }>;
  accountTransfers: Array<{ id: string; number: string; fromAccountId: string; toAccountId: string; amount: number; note: string; occurredAt: string }>;
}
export interface PaymentAccount {
  id: string;
  code: string;
  name: string;
  color: string;
  icon: string;
  isActive: boolean;
  balance: number;
  income: number;
  expenses: number;
}
export interface FinancialMovement {
  id: string;
  paymentMethod: Exclude<PaymentMethod, "note">;
  direction: "in" | "out";
  amount: number;
  documentId: string;
  documentNumber: string;
  partyId: string | null;
  partyName: string | null;
  type: string;
  occurredAt: string;
  transferId?: string | null;
  note?: string | null;
}
export const paymentMethods: Array<{
  id: Exclude<PaymentMethod, "note">;
  label: string;
}> = [
  { id: "cash", label: "نقدي" },
  { id: "bankily", label: "بنكيلي" },
  { id: "masrvi", label: "مصرفي" },
  { id: "sedad", label: "السداد" },
  { id: "bimbank", label: "بيم" },
];
export const kindLabels: Record<DocumentKind, string> = {
  purchase: "فاتورة شراء",
  sale: "فاتورة بيع",
  return: "إرجاع بيع",
  transfer: "تحويل مخزون",
  adjustment: "تصحيح مخزون",
  expense: "فاتورة مصروفات",
  payment: "سداد",
  offset: "مقاصة",
  settlement: "مخالصة",
};
export function western(value: number | string) {
  return String(value)
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}
const DISPLAY_LOCALE = "fr-FR-u-nu-latn";
const numberFormatter = new Intl.NumberFormat(DISPLAY_LOCALE, {
  maximumFractionDigits: 0,
  numberingSystem: "latn",
});

/** Format display values with Latin digits without changing stored data. */
export function formatNumber(value: number) {
  return western(numberFormatter.format(value));
}
export function formatQuantity(value: number) {
  return formatNumber(value);
}
export function formatMoney(value: number) {
  return `${formatNumber(value)} MRU`;
}
export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" },
) {
  return western(new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    ...options,
    numberingSystem: "latn",
  }).format(new Date(value)));
}
export function formatDateTime(value: Date | string | number) {
  return formatDate(value, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Existing view-facing names share the same central formatting policy.
export const money = formatMoney;
export const number = formatNumber;
export function quantity(value: number, pack?: number | null) {
  if (!Number.isInteger(pack) || (pack ?? 0) <= 0) return `${formatQuantity(value)} فرد`;
  const validPack = pack as number;
  const cartons = Math.floor(value / validPack);
  const pieces = value % validPack;
  return cartons
    ? `${number(cartons)} كرتون${pieces ? ` + ${number(pieces)} فرد` : ""}`
    : `${number(pieces)} فرد`;
}
export function saleLineTotal(
  qty: number,
  pack: number | null | undefined,
  piecePrice: number,
  cartonPrice: number,
  pricingMode: "piece" | "carton" = "piece",
) {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  // MRU totals are rounded once per line. Never round the derived unit price.
  if (pricingMode === "carton") {
    if (!Number.isInteger(pack) || (pack ?? 0) <= 0 || qty < (pack as number)) return Math.round(qty * piecePrice);
    return Math.round(qty * cartonPrice / (pack as number));
  }
  return Math.round(qty * piecePrice);
}
export function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
