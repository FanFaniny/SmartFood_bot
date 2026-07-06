/**
 * Drizzle ORM SQLite schema — источник правды для структуры БД и миграций.
 * Соответствует разделу 6 плана (telegram_food_mvp).
 *
 * Денежные суммы — целые в копейках (UAH cents). Булевы значения — integer 0/1.
 * Временные метки — text c DEFAULT CURRENT_TIMESTAMP.
 *
 * Литералы enum продублированы из @smartfood/shared, чтобы пакет db оставался
 * самодостаточным (без межпакетной зависимости в схеме миграций).
 */

import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const ORDER_STATUS = [
  'draft',
  'pending_payment',
  'paid',
  'accepted',
  'preparing',
  'ready',
  'completed',
  'cancelled',
  'payment_failed',
] as const;
const PAYMENT_STATUS = ['unpaid', 'processing', 'paid', 'failed', 'refunded'] as const;
const SERVICE_TYPE = ['dine_in', 'takeaway'] as const;
const MEASURE_UNIT = ['g', 'ml'] as const;
const STAFF_ROLE = ['cook', 'barista', 'manager', 'admin'] as const;
const LOYALTY_TX_TYPE = ['earn', 'spend', 'refund', 'adjustment'] as const;

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);
const updatedAt = () =>
  text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  configJson: text('config_json').notNull(),
  createdAt: createdAt(),
});

export const customers = sqliteTable(
  'customers',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    telegramId: text('telegram_id').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    username: text('username'),
    phone: text('phone'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('customers_tenant_telegram_uq').on(t.tenantId, t.telegramId)],
);

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    categoryId: text('category_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    composition: text('composition'),
    imageUrl: text('image_url'),
    priceUahCents: integer('price_uah_cents').notNull(),
    measureValue: integer('measure_value').notNull(),
    measureUnit: text('measure_unit', { enum: MEASURE_UNIT }).notNull(),
    avgPrepTimeMinutes: integer('avg_prep_time_minutes').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    index('products_tenant_category_active_idx').on(t.tenantId, t.categoryId, t.isActive),
    check('products_measure_unit_chk', sql`${t.measureUnit} in ('g', 'ml')`),
  ],
);

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    customerId: text('customer_id').notNull(),
    status: text('status', { enum: ORDER_STATUS }).notNull(),
    subtotalUahCents: integer('subtotal_uah_cents').notNull(),
    loyaltyDiscountUahCents: integer('loyalty_discount_uah_cents').notNull().default(0),
    totalUahCents: integer('total_uah_cents').notNull(),
    loyaltyPointsSpent: integer('loyalty_points_spent').notNull().default(0),
    loyaltyPointsEarned: integer('loyalty_points_earned').notNull().default(0),
    paymentProvider: text('payment_provider'),
    paymentInvoiceId: text('payment_invoice_id'),
    paymentStatus: text('payment_status', { enum: PAYMENT_STATUS }).notNull().default('unpaid'),
    customerNote: text('customer_note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('orders_tenant_customer_created_idx').on(t.tenantId, t.customerId, t.createdAt),
    index('orders_tenant_status_created_idx').on(t.tenantId, t.status, t.createdAt),
    index('orders_payment_invoice_idx').on(t.paymentInvoiceId),
  ],
);

export const orderItems = sqliteTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id').notNull(),
    productId: text('product_id').notNull(),
    productSnapshotJson: text('product_snapshot_json').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceUahCents: integer('unit_price_uah_cents').notNull(),
    totalPriceUahCents: integer('total_price_uah_cents').notNull(),
    serviceType: text('service_type', { enum: SERVICE_TYPE }),
    allergensNote: text('allergens_note'),
    preferencesNote: text('preferences_note'),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    check('order_items_service_type_chk', sql`${t.serviceType} in ('dine_in', 'takeaway') or ${t.serviceType} is null`),
  ],
);

export const loyaltyAccounts = sqliteTable(
  'loyalty_accounts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    customerId: text('customer_id').notNull(),
    pointsBalance: integer('points_balance').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('loyalty_accounts_tenant_customer_uq').on(t.tenantId, t.customerId)],
);

export const loyaltyTransactions = sqliteTable(
  'loyalty_transactions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    customerId: text('customer_id').notNull(),
    orderId: text('order_id'),
    type: text('type', { enum: LOYALTY_TX_TYPE }).notNull(),
    points: integer('points').notNull(),
    uahEquivalentCents: integer('uah_equivalent_cents').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('loyalty_tx_tenant_customer_created_idx').on(t.tenantId, t.customerId, t.createdAt),
    check('loyalty_tx_type_chk', sql`${t.type} in ('earn', 'spend', 'refund', 'adjustment')`),
  ],
);

export const staffMembers = sqliteTable(
  'staff_members',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    telegramId: text('telegram_id').notNull(),
    role: text('role', { enum: STAFF_ROLE }).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [
    uniqueIndex('staff_members_tenant_telegram_uq').on(t.tenantId, t.telegramId),
    check('staff_members_role_chk', sql`${t.role} in ('cook', 'barista', 'manager', 'admin')`),
  ],
);

export const orderEvents = sqliteTable(
  'order_events',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    orderId: text('order_id').notNull(),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    eventType: text('event_type').notNull(),
    payloadJson: text('payload_json'),
    createdAt: createdAt(),
  },
  (t) => [index('order_events_order_created_idx').on(t.orderId, t.createdAt)],
);

export const schema = {
  tenants,
  customers,
  categories,
  products,
  orders,
  orderItems,
  loyaltyAccounts,
  loyaltyTransactions,
  staffMembers,
  orderEvents,
};

export type Schema = typeof schema;
