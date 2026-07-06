CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`telegram_id` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`username` text,
	`phone` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_tenant_telegram_uq` ON `customers` (`tenant_id`,`telegram_id`);--> statement-breakpoint
CREATE TABLE `loyalty_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`points_balance` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loyalty_accounts_tenant_customer_uq` ON `loyalty_accounts` (`tenant_id`,`customer_id`);--> statement-breakpoint
CREATE TABLE `loyalty_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`order_id` text,
	`type` text NOT NULL,
	`points` integer NOT NULL,
	`uah_equivalent_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "loyalty_tx_type_chk" CHECK("loyalty_transactions"."type" in ('earn', 'spend', 'refund', 'adjustment'))
);
--> statement-breakpoint
CREATE INDEX `loyalty_tx_tenant_customer_created_idx` ON `loyalty_transactions` (`tenant_id`,`customer_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`order_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`event_type` text NOT NULL,
	`payload_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `order_events_order_created_idx` ON `order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_snapshot_json` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_uah_cents` integer NOT NULL,
	`total_price_uah_cents` integer NOT NULL,
	`service_type` text,
	`allergens_note` text,
	`preferences_note` text,
	CONSTRAINT "order_items_service_type_chk" CHECK("order_items"."service_type" in ('dine_in', 'takeaway') or "order_items"."service_type" is null)
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`status` text NOT NULL,
	`subtotal_uah_cents` integer NOT NULL,
	`loyalty_discount_uah_cents` integer DEFAULT 0 NOT NULL,
	`total_uah_cents` integer NOT NULL,
	`loyalty_points_spent` integer DEFAULT 0 NOT NULL,
	`loyalty_points_earned` integer DEFAULT 0 NOT NULL,
	`payment_provider` text,
	`payment_invoice_id` text,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`customer_note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `orders_tenant_customer_created_idx` ON `orders` (`tenant_id`,`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_tenant_status_created_idx` ON `orders` (`tenant_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_payment_invoice_idx` ON `orders` (`payment_invoice_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`composition` text,
	`image_url` text,
	`price_uah_cents` integer NOT NULL,
	`measure_value` integer NOT NULL,
	`measure_unit` text NOT NULL,
	`avg_prep_time_minutes` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "products_measure_unit_chk" CHECK("products"."measure_unit" in ('g', 'ml'))
);
--> statement-breakpoint
CREATE INDEX `products_tenant_category_active_idx` ON `products` (`tenant_id`,`category_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `staff_members` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`telegram_id` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT "staff_members_role_chk" CHECK("staff_members"."role" in ('cook', 'barista', 'manager', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_members_tenant_telegram_uq` ON `staff_members` (`tenant_id`,`telegram_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`config_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
