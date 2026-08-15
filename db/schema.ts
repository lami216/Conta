import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const parties = sqliteTable("parties", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const warehouses = sqliteTable("warehouses", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  isSalesDefault: integer("is_sales_default").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode"),
  pieceCost: integer("piece_cost").notNull(),
  piecePrice: integer("piece_price"),
  cartonPrice: integer("carton_price"),
  piecesPerCarton: integer("pieces_per_carton").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    kind: text("kind").notNull(),
    partyId: text("party_id").references(() => parties.id),
    warehouseId: text("warehouse_id").references(() => warehouses.id),
    destinationWarehouseId: text("destination_warehouse_id").references(
      () => warehouses.id,
    ),
    parentDocumentId: text("parent_document_id"),
    paymentMethod: text("payment_method"),
    status: text("status").notNull().default("posted"),
    title: text("title"),
    total: integer("total").notNull().default(0),
    dueTotal: integer("due_total").notNull().default(0),
    recurrenceKey: text("recurrence_key").unique(),
    occurredAt: text("occurred_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_documents_party").on(t.partyId, t.occurredAt),
    index("idx_documents_warehouse").on(t.warehouseId, t.occurredAt),
  ],
);
export const documentLines = sqliteTable(
  "document_lines",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    productId: text("product_id").references(() => products.id),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("idx_lines_document").on(t.documentId)],
);
export const stockBalances = sqliteTable(
  "stock_balances",
  {
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull().default(0),
  },
  (t) => [uniqueIndex("stock_balance_key").on(t.warehouseId, t.productId)],
);
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    movementType: text("movement_type").notNull(),
    quantityDelta: integer("quantity_delta").notNull(),
    balanceBefore: integer("balance_before").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    occurredAt: text("occurred_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_movements_product").on(t.warehouseId, t.productId, t.occurredAt),
  ],
);
export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id),
    side: text("side").notNull(),
    amountDelta: integer("amount_delta").notNull(),
    occurredAt: text("occurred_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("idx_ledger_party").on(t.partyId, t.occurredAt)],
);
export const allocations = sqliteTable(
  "allocations",
  {
    id: text("id").primaryKey(),
    settlementDocumentId: text("settlement_document_id")
      .notNull()
      .references(() => documents.id),
    sourceDocumentId: text("source_document_id")
      .notNull()
      .references(() => documents.id),
    side: text("side").notNull(),
    amount: integer("amount").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("allocation_key").on(
      t.settlementDocumentId,
      t.sourceDocumentId,
      t.side,
    ),
    index("idx_allocations_source").on(t.sourceDocumentId, t.side),
  ],
);
export const recurringExpenses = sqliteTable("recurring_expenses", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  amount: integer("amount").notNull(),
  frequency: text("frequency").notNull(),
  startsOn: text("starts_on").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  documentId: text("document_id").references(() => documents.id),
  action: text("action").notNull(),
  payload: text("payload").notNull().default("{}"),
  userName: text("user_name"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
