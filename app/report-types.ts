export type ReportType = "overview" | "sales" | "purchases" | "product-sales" | "stock" | "profit" | "debts" | "party-ledger" | "financial" | "expenses" | "returns";
export type ReportGroup = "invoice" | "product";
export interface ReportFilters { type: ReportType; from?: string; to?: string; allTime?: boolean; partyId?: string; productId?: string; warehouseId?: string; paymentAccountId?: string; movementType?: string; direction?: "in" | "out"; groupBy?: ReportGroup; sortBy?: "quantity" | "sales" | "name" | "profit"; debtSide?: "receivable" | "payable" | "clear"; search?: string; expenseType?: "once" | "recurring"; page: number; pageSize: number }
export interface ReportMeta { page: number; pageSize: number; totalRows: number; totalPages: number; accountTotals?: Array<{ account: string; incoming: number; outgoing: number; net: number }> }
export interface ReportResponse<Row = ReportRow> { report: ReportType; from: string | null; to: string | null; summary: Record<string, number | string | boolean>; rows: Row[]; meta: ReportMeta }
export interface ReportRow { id?: string; documentId?: string; partyId?: string; [key: string]: string | number | boolean | null | undefined }
export type SalesReportRow = ReportRow & { documentId: string; number: string; occurredAt: string; party: string; paymentMethod: string; total: number; cost: number; profit: number; margin: number; paid: number; due: number };
export type ProductSalesReportRow = ReportRow & { productId: string; sku: string; product: string; soldQuantity: number; returnedQuantity: number; netQuantity: number; sales: number; returns: number; netSales: number; averagePrice: number };
export type StockMovementReportRow = ReportRow & { occurredAt: string; sku: string; product: string; warehouse: string; movementType: string; before: number; change: number; after: number; documentNumber: string };

/** Reporting numbers never expose missing or non-finite values to the UI. */
export function reportNumber(value: unknown) {
  const numeric = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(numeric) ? 0 : numeric;
}

export type SummaryTone = "positive" | "negative" | "neutral";
export function reportSummaryTone(type: ReportType, key: string, value: unknown): SummaryTone {
  const amount = reportNumber(value), signed = (): SummaryTone => amount > 0 ? "positive" : amount < 0 ? "negative" : "neutral";
  if (["receivable", "payable"].includes(key) && ["debts", "party-ledger"].includes(type)) return amount > 0 ? "negative" : "neutral";
  if (key === "net" && ["debts", "party-ledger"].includes(type)) return amount === 0 ? "neutral" : "negative";
  if (key === "profit" || (type === "financial" && key === "net")) return signed();
  if ((type === "sales" && key === "netSales") || (type === "product-sales" && ["sales", "netSales"].includes(key)) || (type === "profit" && key === "revenue") || (type === "stock" && key === "incoming") || (type === "financial" && key === "incoming") || (type === "overview" && key === "sales")) return "positive";
  if ((type === "returns" && key === "total") || (type === "stock" && key === "outgoing") || (type === "financial" && key === "outgoing") || (type === "expenses" && key === "total") || (type === "overview" && key === "expenses")) return "negative";
  return "neutral";
}

export function reportDateQuery(allTime: boolean, from: string, to: string) {
  return allTime ? { allTime: "true" } : { from, to };
}

/** Columns remain presentation metadata before a query has returned rows. */
export function reportTableModel(columns: Array<[string, string]>, result: ReportResponse | null) {
  return { columns, rows: result?.rows ?? [] };
}
