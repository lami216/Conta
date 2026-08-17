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
  parties: Party[];
  warehouses: Warehouse[];
  products: Product[];
  documents: DocumentRecord[];
  movements: Movement[];
  recurringExpenses: Array<{
    id: string;
    title: string;
    amount: number;
    frequency: "daily" | "monthly";
    startsOn: string;
    active: boolean;
  }>;
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
export function money(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} MRU`;
}
export function number(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    value,
  );
}
export function quantity(value: number, pack?: number | null) {
  if (!Number.isInteger(pack) || (pack ?? 0) <= 0) return `${number(value)} فرد`;
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
