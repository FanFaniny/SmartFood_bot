export const OrderStatus = {
  DRAFT: 'draft',
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  PAYMENT_FAILED: 'payment_failed',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ServiceType = {
  DINE_IN: 'dine_in',
  TAKEAWAY: 'takeaway',
} as const;
export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];

export const MeasureUnit = {
  GRAMS: 'g',
  MILLILITERS: 'ml',
} as const;
export type MeasureUnit = (typeof MeasureUnit)[keyof typeof MeasureUnit];

export const StaffRole = {
  COOK: 'cook',
  BARISTA: 'barista',
  MANAGER: 'manager',
  ADMIN: 'admin',
} as const;
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];

export const LoyaltyTransactionType = {
  EARN: 'earn',
  SPEND: 'spend',
  REFUND: 'refund',
  ADJUSTMENT: 'adjustment',
} as const;
export type LoyaltyTransactionType = (typeof LoyaltyTransactionType)[keyof typeof LoyaltyTransactionType];

export const PaymentStatus = {
  UNPAID: 'unpaid',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentProvider = {
  MONOPAY: 'monopay',
} as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

/** Кто инициировал событие заказа (order_events.actor_type). */
export const ActorType = {
  CUSTOMER: 'customer',
  STAFF: 'staff',
  SYSTEM: 'system',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

/** Тип события в журнале заказа (order_events.event_type). */
export const OrderEventType = {
  CREATED: 'created',
  PAYMENT_INVOICE_CREATED: 'payment_invoice_created',
  PAYMENT_SUCCEEDED: 'payment_succeeded',
  PAYMENT_FAILED: 'payment_failed',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type OrderEventType = (typeof OrderEventType)[keyof typeof OrderEventType];

/** Все значения enum как массивы — удобно для SQLite CHECK / Zod / валидации. */
export const ORDER_STATUS_VALUES = Object.values(OrderStatus);
export const SERVICE_TYPE_VALUES = Object.values(ServiceType);
export const MEASURE_UNIT_VALUES = Object.values(MeasureUnit);
export const STAFF_ROLE_VALUES = Object.values(StaffRole);
export const LOYALTY_TRANSACTION_TYPE_VALUES = Object.values(LoyaltyTransactionType);
export const PAYMENT_STATUS_VALUES = Object.values(PaymentStatus);
export const PAYMENT_PROVIDER_VALUES = Object.values(PaymentProvider);
export const ACTOR_TYPE_VALUES = Object.values(ActorType);
export const ORDER_EVENT_TYPE_VALUES = Object.values(OrderEventType);
