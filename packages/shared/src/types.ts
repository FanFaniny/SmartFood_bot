/**
 * Общие доменные типы для API, webapp и bot.
 *
 * Соглашения:
 * - все денежные суммы хранятся и передаются в копейках (UAH cents, целое число);
 * - даты передаются строками в ISO-8601 (как их отдаёт SQLite CURRENT_TIMESTAMP / клиент);
 * - типы повторяют структуру таблиц из packages/db (см. раздел 6 плана), но в camelCase.
 */

import type {
  ActorType,
  LoyaltyTransactionType,
  MeasureUnit,
  OrderEventType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  ServiceType,
  StaffRole,
} from './enums.js';

export interface Tenant {
  id: string;
  name: string;
  configJson: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  composition: string | null;
  imageUrl: string | null;
  priceUahCents: number;
  measureValue: number;
  measureUnit: MeasureUnit;
  avgPrepTimeMinutes: number;
  isActive: boolean;
  sortOrder: number;
}

export interface Order {
  id: string;
  tenantId: string;
  customerId: string;
  status: OrderStatus;
  subtotalUahCents: number;
  loyaltyDiscountUahCents: number;
  totalUahCents: number;
  loyaltyPointsSpent: number;
  loyaltyPointsEarned: number;
  paymentProvider: PaymentProvider | null;
  paymentInvoiceId: string | null;
  paymentStatus: PaymentStatus;
  customerNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Снимок товара на момент заказа (order_items.product_snapshot_json). */
export interface ProductSnapshot {
  productId: string;
  name: string;
  composition: string | null;
  measureValue: number;
  measureUnit: MeasureUnit;
  priceUahCents: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productSnapshot: ProductSnapshot;
  quantity: number;
  unitPriceUahCents: number;
  totalPriceUahCents: number;
  serviceType: ServiceType | null;
  allergensNote: string | null;
  preferencesNote: string | null;
}

export interface LoyaltyAccount {
  id: string;
  tenantId: string;
  customerId: string;
  pointsBalance: number;
  updatedAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  tenantId: string;
  customerId: string;
  orderId: string | null;
  type: LoyaltyTransactionType;
  points: number;
  uahEquivalentCents: number;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  tenantId: string;
  telegramId: string;
  role: StaffRole;
  isActive: boolean;
}

export interface OrderEvent {
  id: string;
  tenantId: string;
  orderId: string;
  actorType: ActorType;
  actorId: string | null;
  eventType: OrderEventType;
  payloadJson: string | null;
  createdAt: string;
}

/* ----------------------------------------------------------------------------
 * DTO для клиентского API (ответы, удобные для webapp)
 * -------------------------------------------------------------------------- */

/** Категория меню с вложенными активными товарами (GET /api/menu). */
export interface MenuCategory extends Pick<Category, 'id' | 'name' | 'sortOrder'> {
  products: Product[];
}

/** Заказ вместе с позициями (GET /api/orders/:id). */
export interface OrderWithItems extends Order {
  items: OrderItem[];
}

/** Сводка по лояльности для главной/LoyaltyPage. */
export interface LoyaltySummary {
  pointsBalance: number;
  uahEquivalentCents: number;
  earnRatePercent: number;
  maxSpendPercentOfOrder: number;
}
