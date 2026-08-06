export type LocationId = "warehouse" | "boutique";

export type PaymentMethod =
  | "cash"
  | "bankily"
  | "masrvi"
  | "sedad"
  | "bimbank";

export type MovementType = "receipt" | "transfer" | "sale" | "customer-payment";

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  barcode: string;
  piecesPerCarton: number;
  pieceCost: number;
  piecePrice: number;
  cartonPrice: number;
  stock: Record<LocationId, number>;
  accent: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
  creditLimit: number | null;
  lastActivity: string;
}

export interface CartLine {
  productId: string;
  quantityPieces: number;
}

export interface SaleRecord {
  id: string;
  createdAt: string;
  total: number;
  paymentMethod: PaymentMethod | "credit";
  customerName: string;
  itemCount: number;
}

export interface MovementRecord {
  id: string;
  createdAt: string;
  type: MovementType;
  productName?: string;
  quantityPieces?: number;
  piecesPerCarton?: number;
  from?: LocationId;
  to?: LocationId;
  reference: string;
  note: string;
}

export interface ToastMessage {
  id: number;
  title: string;
  message: string;
  tone?: "success" | "warning";
}

export const paymentMethods: Array<{
  id: PaymentMethod;
  label: string;
  shortLabel: string;
}> = [
  { id: "cash", label: "نقدي", shortLabel: "نقدي" },
  { id: "bankily", label: "بنكيلي", shortLabel: "بنكيلي" },
  { id: "masrvi", label: "مصرفي", shortLabel: "مصرفي" },
  { id: "sedad", label: "السداد", shortLabel: "السداد" },
  { id: "bimbank", label: "بيم بنك", shortLabel: "بيم" },
];

export const locationLabels: Record<LocationId, string> = {
  warehouse: "المخزن الرئيسي",
  boutique: "البوتيك",
};

export function formatMoney(value: number) {
  return `${new Intl.NumberFormat("ar-MR", {
    maximumFractionDigits: 0,
  }).format(value)} MRU`;
}

export function splitQuantity(quantityPieces: number, piecesPerCarton: number) {
  const safePack = Math.max(1, piecesPerCarton);
  return {
    cartons: Math.floor(quantityPieces / safePack),
    pieces: quantityPieces % safePack,
  };
}

export function formatQuantity(quantityPieces: number, piecesPerCarton: number) {
  const { cartons, pieces } = splitQuantity(quantityPieces, piecesPerCarton);
  if (cartons && pieces) return `${cartons} كرتون + ${pieces} فرد`;
  if (cartons) return `${cartons} كرتون`;
  return `${pieces} فرد`;
}

export function calculateLineTotal(product: Product, quantityPieces: number) {
  const { cartons, pieces } = splitQuantity(
    quantityPieces,
    product.piecesPerCarton,
  );
  return cartons * product.cartonPrice + pieces * product.piecePrice;
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function todayLabel() {
  return new Intl.DateTimeFormat("ar-MR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Nouakchott",
  }).format(new Date());
}

export function timeLabel(date = new Date()) {
  return new Intl.DateTimeFormat("ar-MR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nouakchott",
  }).format(date);
}
