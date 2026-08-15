CREATE TABLE `allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_document_id` text NOT NULL,
	`source_document_id` text NOT NULL,
	`side` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`settlement_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `allocation_key` ON `allocations` (`settlement_document_id`,`source_document_id`,`side`);--> statement-breakpoint
CREATE INDEX `idx_allocations_source` ON `allocations` (`source_document_id`,`side`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text,
	`action` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`user_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `document_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`product_id` text,
	`description` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`line_total` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lines_document` ON `document_lines` (`document_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`kind` text NOT NULL,
	`party_id` text,
	`warehouse_id` text,
	`destination_warehouse_id` text,
	`parent_document_id` text,
	`payment_method` text,
	`status` text DEFAULT 'posted' NOT NULL,
	`title` text,
	`total` integer DEFAULT 0 NOT NULL,
	`due_total` integer DEFAULT 0 NOT NULL,
	`recurrence_key` text,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_number_unique` ON `documents` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `documents_recurrence_key_unique` ON `documents` (`recurrence_key`);--> statement-breakpoint
CREATE INDEX `idx_documents_party` ON `documents` (`party_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_documents_warehouse` ON `documents` (`warehouse_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`party_id` text NOT NULL,
	`side` text NOT NULL,
	`amount_delta` integer NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ledger_party` ON `ledger_entries` (`party_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `parties` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`barcode` text,
	`piece_cost` integer NOT NULL,
	`piece_price` integer,
	`carton_price` integer,
	`pieces_per_carton` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `recurring_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`amount` integer NOT NULL,
	`frequency` text NOT NULL,
	`starts_on` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_balances` (
	`warehouse_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_balance_key` ON `stock_balances` (`warehouse_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`warehouse_id` text NOT NULL,
	`product_id` text NOT NULL,
	`movement_type` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`balance_before` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_movements_product` ON `stock_movements` (`warehouse_id`,`product_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_sales_default` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warehouses_name_unique` ON `warehouses` (`name`);
--> statement-breakpoint
CREATE TRIGGER immutable_posted_documents BEFORE DELETE ON documents WHEN OLD.status = 'posted' BEGIN SELECT RAISE(ABORT, 'posted documents are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER immutable_stock_movements BEFORE DELETE ON stock_movements BEGIN SELECT RAISE(ABORT, 'stock movements are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER immutable_ledger_entries BEFORE DELETE ON ledger_entries BEGIN SELECT RAISE(ABORT, 'ledger entries are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER allocation_not_over_source BEFORE INSERT ON allocations BEGIN SELECT CASE WHEN (SELECT COALESCE(SUM(amount),0) FROM allocations WHERE source_document_id = NEW.source_document_id AND side = NEW.side) + NEW.amount > (SELECT due_total FROM documents WHERE id = NEW.source_document_id) THEN RAISE(ABORT, 'allocation exceeds source due') END; END;
--> statement-breakpoint
INSERT OR IGNORE INTO warehouses (id, name, is_sales_default) VALUES ('wh-main', 'المخزن الرئيسي', 0), ('wh-boutique', 'البوتيك', 1);
