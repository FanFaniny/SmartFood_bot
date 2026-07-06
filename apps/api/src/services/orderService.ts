import { randomUUID } from 'node:crypto';

import type { TenantConfig } from '@smartfood/config';
import {
  customers,
  orderEvents,
  orderItems,
  orders,
  products,
  type DatabaseClient,
} from '@smartfood/db';
import type { FastifyBaseLogger } from 'fastify';
import {
  ActorType,
  LoyaltyTransactionType,
  OrderEventType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  type CreateOrderRequest,
  type Order,
  type OrderItem,
  type OrderPreviewRequest,
  type OrderPreviewResult,
  type OrderWithItems,
  type ProductSnapshot,
} from '@smartfood/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';

import type { Executor, Tx } from '../db-types.js';
import { AppError } from '../plugins/errors.js';
import {
  computeEarnedPoints,
  maxSpendablePoints,
  pointsToDiscountCents,
  type LoyaltyService,
} from './loyaltyService.js';
import type { InvoiceResult, PaymentService } from './paymentService.js';
import type { TelegramNotifyService } from './telegramNotifyService.js';

export interface OrderServiceDeps {
  db: DatabaseClient;
  loyalty: LoyaltyService;
  payment: PaymentService;
  notify: TelegramNotifyService;
  log: FastifyBaseLogger;
}

export interface ActorContext {
  actorType: (typeof ActorType)[keyof typeof ActorType];
  actorId: string | null;
}

interface ComputedItem {
  productId: string;
  name: string;
  snapshot: ProductSnapshot;
  quantity: number;
  unitPriceUahCents: number;
  totalPriceUahCents: number;
  serviceType: OrderItem['serviceType'];
  allergensNote: string | null;
  preferencesNote: string | null;
}

interface ComputedOrder {
  items: ComputedItem[];
  result: OrderPreviewResult;
}

type OrderRow = typeof orders.$inferSelect;

function mapOrderRow(row: OrderRow): Order {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    status: row.status,
    subtotalUahCents: row.subtotalUahCents,
    loyaltyDiscountUahCents: row.loyaltyDiscountUahCents,
    totalUahCents: row.totalUahCents,
    loyaltyPointsSpent: row.loyaltyPointsSpent,
    loyaltyPointsEarned: row.loyaltyPointsEarned,
    paymentProvider: (row.paymentProvider as Order['paymentProvider']) ?? null,
    paymentInvoiceId: row.paymentInvoiceId,
    paymentStatus: row.paymentStatus,
    customerNote: row.customerNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapItemRow(row: typeof orderItems.$inferSelect): OrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    productId: row.productId,
    productSnapshot: JSON.parse(row.productSnapshotJson) as ProductSnapshot,
    quantity: row.quantity,
    unitPriceUahCents: row.unitPriceUahCents,
    totalPriceUahCents: row.totalPriceUahCents,
    serviceType: row.serviceType,
    allergensNote: row.allergensNote,
    preferencesNote: row.preferencesNote,
  };
}

export function createOrderService(deps: OrderServiceDeps) {
  const { db, loyalty, payment, notify, log } = deps;

  async function addEvent(
    exec: Executor,
    params: {
      tenantId: string;
      orderId: string;
      actor: ActorContext;
      eventType: (typeof OrderEventType)[keyof typeof OrderEventType];
      payload?: unknown;
    },
  ): Promise<void> {
    await exec.insert(orderEvents).values({
      id: randomUUID(),
      tenantId: params.tenantId,
      orderId: params.orderId,
      actorType: params.actor.actorType,
      actorId: params.actor.actorId,
      eventType: params.eventType,
      payloadJson: params.payload === undefined ? null : JSON.stringify(params.payload),
      createdAt: new Date().toISOString(),
    });
  }

  async function getItems(exec: Executor, orderId: string): Promise<OrderItem[]> {
    const rows = await exec.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    return rows.map(mapItemRow);
  }

  /** Пересчитывает корзину по ценам из БД (frontend-ценам не доверяем). */
  async function computeOrder(
    exec: Executor,
    tenantId: string,
    customerId: string,
    req: OrderPreviewRequest,
    config: TenantConfig,
  ): Promise<ComputedOrder> {
    const productIds = [...new Set(req.items.map((i) => i.productId))];
    const productRows = await exec
      .select()
      .from(products)
      .where(and(eq(products.tenantId, tenantId), inArray(products.id, productIds)));

    const byId = new Map(productRows.map((p) => [p.id, p]));

    const items: ComputedItem[] = [];
    let subtotalUahCents = 0;

    for (const input of req.items) {
      const product = byId.get(input.productId);
      if (!product || !product.isActive) {
        throw AppError.badRequest(`Товар недоступний: ${input.productId}`);
      }
      const unitPriceUahCents = product.priceUahCents;
      const totalPriceUahCents = unitPriceUahCents * input.quantity;
      subtotalUahCents += totalPriceUahCents;

      const snapshot: ProductSnapshot = {
        productId: product.id,
        name: product.name,
        composition: product.composition,
        measureValue: product.measureValue,
        measureUnit: product.measureUnit,
        priceUahCents: product.priceUahCents,
      };

      items.push({
        productId: product.id,
        name: product.name,
        snapshot,
        quantity: input.quantity,
        unitPriceUahCents,
        totalPriceUahCents,
        serviceType: input.serviceType ?? null,
        allergensNote: input.allergensNote ?? null,
        preferencesNote: input.preferencesNote ?? null,
      });
    }

    const balance = await loyalty.getBalance(tenantId, customerId);
    const maxSpendable = maxSpendablePoints(subtotalUahCents, balance, config);
    const requested = req.pointsToSpend ?? 0;
    const loyaltyPointsSpent = Math.max(0, Math.min(requested, maxSpendable));
    const loyaltyDiscountUahCents = Math.min(pointsToDiscountCents(loyaltyPointsSpent, config), subtotalUahCents);
    const totalUahCents = subtotalUahCents - loyaltyDiscountUahCents;
    const loyaltyPointsEarned = computeEarnedPoints(totalUahCents, config);

    return {
      items,
      result: {
        lines: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unitPriceUahCents: i.unitPriceUahCents,
          totalPriceUahCents: i.totalPriceUahCents,
        })),
        subtotalUahCents,
        loyaltyPointsSpent,
        loyaltyDiscountUahCents,
        totalUahCents,
        loyaltyPointsEarned,
        maxLoyaltyPointsSpendable: maxSpendable,
      },
    };
  }

  /** Идемпотентно переводит заказ в paid: начисляет баллы и уведомляет персонал. */
  async function finalizePaidOrder(orderId: string, config: TenantConfig): Promise<void> {
    let shouldNotify = false;
    let finalOrder: Order | null = null;
    let finalItems: OrderItem[] = [];

    await db.transaction(async (tx: Tx) => {
      const rows = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      const row = rows[0];
      if (!row) throw AppError.notFound('Замовлення не знайдено');
      if (row.paymentStatus === PaymentStatus.PAID) return; // уже обработан

      const earned = computeEarnedPoints(row.totalUahCents, config);
      const now = new Date().toISOString();

      await tx
        .update(orders)
        .set({
          status: OrderStatus.PAID,
          paymentStatus: PaymentStatus.PAID,
          loyaltyPointsEarned: earned,
          updatedAt: now,
        })
        .where(eq(orders.id, orderId));

      if (earned > 0) {
        await loyalty.recordTransaction(tx, {
          tenantId: row.tenantId,
          customerId: row.customerId,
          orderId,
          type: LoyaltyTransactionType.EARN,
          points: earned,
          uahEquivalentCents: pointsToDiscountCents(earned, config),
        });
      }

      await addEvent(tx, {
        tenantId: row.tenantId,
        orderId,
        actor: { actorType: ActorType.SYSTEM, actorId: null },
        eventType: OrderEventType.PAYMENT_SUCCEEDED,
      });

      finalOrder = mapOrderRow({ ...row, status: OrderStatus.PAID, paymentStatus: PaymentStatus.PAID, loyaltyPointsEarned: earned, updatedAt: now });
      finalItems = await getItems(tx, orderId);
      shouldNotify = true;
    });

    if (shouldNotify && finalOrder) {
      const paid: Order = finalOrder;
      log.info(
        { orderId, customerId: paid.customerId, totalUahCents: paid.totalUahCents, pointsEarned: paid.loyaltyPointsEarned },
        '[order] paid & finalized',
      );
      await notify.notifyStaffNewOrder(paid, finalItems, config);
    } else {
      log.debug({ orderId }, '[order] finalizePaidOrder skipped (already paid)');
    }
  }

  async function refundSpentAndEarned(
    tx: Tx,
    row: OrderRow,
    config: TenantConfig,
  ): Promise<void> {
    if (row.loyaltyPointsSpent > 0) {
      await loyalty.recordTransaction(tx, {
        tenantId: row.tenantId,
        customerId: row.customerId,
        orderId: row.id,
        type: LoyaltyTransactionType.REFUND,
        points: row.loyaltyPointsSpent,
        uahEquivalentCents: pointsToDiscountCents(row.loyaltyPointsSpent, config),
      });
    }
    if (row.loyaltyPointsEarned > 0) {
      await loyalty.recordTransaction(tx, {
        tenantId: row.tenantId,
        customerId: row.customerId,
        orderId: row.id,
        type: LoyaltyTransactionType.ADJUSTMENT,
        points: -row.loyaltyPointsEarned,
        uahEquivalentCents: 0,
      });
    }
  }

  return {
    async preview(
      tenantId: string,
      customerId: string,
      req: OrderPreviewRequest,
      config: TenantConfig,
    ): Promise<OrderPreviewResult> {
      const { result } = await computeOrder(db, tenantId, customerId, req, config);
      return result;
    },

    async create(
      tenantId: string,
      customerId: string,
      req: CreateOrderRequest,
      config: TenantConfig,
    ): Promise<{ order: Order; items: OrderItem[]; payment?: InvoiceResult }> {
      const paymentsEnabled = config.features.payments;
      const orderId = randomUUID();

      const created = await db.transaction(async (tx: Tx) => {
        const { items, result } = await computeOrder(tx, tenantId, customerId, req, config);
        const now = new Date().toISOString();
        const status = paymentsEnabled ? OrderStatus.PENDING_PAYMENT : OrderStatus.PAID;

        await tx.insert(orders).values({
          id: orderId,
          tenantId,
          customerId,
          status,
          subtotalUahCents: result.subtotalUahCents,
          loyaltyDiscountUahCents: result.loyaltyDiscountUahCents,
          totalUahCents: result.totalUahCents,
          loyaltyPointsSpent: result.loyaltyPointsSpent,
          loyaltyPointsEarned: 0,
          paymentStatus: PaymentStatus.UNPAID,
          customerNote: req.customerNote ?? null,
          createdAt: now,
          updatedAt: now,
        });

        for (const item of items) {
          await tx.insert(orderItems).values({
            id: randomUUID(),
            orderId,
            productId: item.productId,
            productSnapshotJson: JSON.stringify(item.snapshot),
            quantity: item.quantity,
            unitPriceUahCents: item.unitPriceUahCents,
            totalPriceUahCents: item.totalPriceUahCents,
            serviceType: item.serviceType,
            allergensNote: item.allergensNote,
            preferencesNote: item.preferencesNote,
          });
        }

        if (result.loyaltyPointsSpent > 0) {
          await loyalty.recordTransaction(tx, {
            tenantId,
            customerId,
            orderId,
            type: LoyaltyTransactionType.SPEND,
            points: result.loyaltyPointsSpent,
            uahEquivalentCents: result.loyaltyDiscountUahCents,
          });
        }

        await addEvent(tx, {
          tenantId,
          orderId,
          actor: { actorType: ActorType.CUSTOMER, actorId: customerId },
          eventType: OrderEventType.CREATED,
          payload: { totalUahCents: result.totalUahCents },
        });

        const orderRows = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        return { order: mapOrderRow(orderRows[0]!), items: await getItems(tx, orderId) };
      });

      log.info(
        {
          orderId,
          tenantId,
          customerId,
          itemCount: created.items.length,
          subtotalUahCents: created.order.subtotalUahCents,
          loyaltyDiscountUahCents: created.order.loyaltyDiscountUahCents,
          totalUahCents: created.order.totalUahCents,
          loyaltyPointsSpent: created.order.loyaltyPointsSpent,
          paymentsEnabled,
        },
        '[order] created',
      );

      if (!paymentsEnabled) {
        await finalizePaidOrder(orderId, config);
        const refreshed = await this.getById(tenantId, customerId, orderId);
        return { order: refreshed, items: refreshed.items };
      }

      const invoice = await payment.createInvoice(created.order, config);
      const now = new Date().toISOString();
      await db
        .update(orders)
        .set({
          paymentProvider: PaymentProvider.MONOPAY,
          paymentInvoiceId: invoice.invoiceId,
          paymentStatus: PaymentStatus.PROCESSING,
          updatedAt: now,
        })
        .where(eq(orders.id, orderId));
      await addEvent(db, {
        tenantId,
        orderId,
        actor: { actorType: ActorType.SYSTEM, actorId: null },
        eventType: OrderEventType.PAYMENT_INVOICE_CREATED,
        payload: { invoiceId: invoice.invoiceId },
      });
      log.info({ orderId, invoiceId: invoice.invoiceId }, '[order] payment invoice created');

      const updated = await this.getById(tenantId, customerId, orderId);
      return { order: updated, items: updated.items, payment: invoice };
    },

    async createInvoiceForExisting(
      tenantId: string,
      customerId: string,
      orderId: string,
      config: TenantConfig,
    ): Promise<InvoiceResult> {
      const found = await this.getById(tenantId, customerId, orderId);
      if (found.status !== OrderStatus.PENDING_PAYMENT) {
        throw AppError.conflict('Оплата для цього замовлення не потрібна');
      }
      const invoice = await payment.createInvoice(found, config);
      const now = new Date().toISOString();
      await db
        .update(orders)
        .set({
          paymentProvider: PaymentProvider.MONOPAY,
          paymentInvoiceId: invoice.invoiceId,
          paymentStatus: PaymentStatus.PROCESSING,
          updatedAt: now,
        })
        .where(eq(orders.id, orderId));
      await addEvent(db, {
        tenantId,
        orderId,
        actor: { actorType: ActorType.SYSTEM, actorId: null },
        eventType: OrderEventType.PAYMENT_INVOICE_CREATED,
        payload: { invoiceId: invoice.invoiceId },
      });
      log.info({ orderId, invoiceId: invoice.invoiceId }, '[order] payment invoice re-created');
      return invoice;
    },

    async listByCustomer(tenantId: string, customerId: string): Promise<Order[]> {
      const rows = await db
        .select()
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.customerId, customerId)))
        .orderBy(desc(orders.createdAt))
        .limit(50);
      return rows.map(mapOrderRow);
    },

    async listActiveForStaff(tenantId: string): Promise<OrderWithItems[]> {
      const activeStatuses: string[] = [
        OrderStatus.PAID,
        OrderStatus.ACCEPTED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
      ];
      const rows = await db
        .select()
        .from(orders)
        .where(eq(orders.tenantId, tenantId))
        .orderBy(desc(orders.createdAt))
        .limit(100);
      const active = rows.filter((r) => activeStatuses.includes(r.status));
      const result: OrderWithItems[] = [];
      for (const row of active) {
        result.push({ ...mapOrderRow(row), items: await getItems(db, row.id) });
      }
      return result;
    },

    async getById(tenantId: string, customerId: string, orderId: string): Promise<OrderWithItems> {
      const rows = await db
        .select()
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId), eq(orders.customerId, customerId)))
        .limit(1);
      const row = rows[0];
      if (!row) throw AppError.notFound('Замовлення не знайдено');
      return { ...mapOrderRow(row), items: await getItems(db, orderId) };
    },

    async cancelByCustomer(
      tenantId: string,
      customerId: string,
      orderId: string,
      config: TenantConfig,
    ): Promise<Order> {
      return db.transaction(async (tx: Tx) => {
        const rows = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId), eq(orders.customerId, customerId)))
          .limit(1);
        const row = rows[0];
        if (!row) throw AppError.notFound('Замовлення не знайдено');

        const cancellable: string[] = [OrderStatus.PENDING_PAYMENT, OrderStatus.PAID];
        if (!cancellable.includes(row.status)) {
          throw AppError.conflict('Замовлення вже не можна скасувати');
        }

        await refundSpentAndEarned(tx, row, config);
        const now = new Date().toISOString();
        await tx
          .update(orders)
          .set({ status: OrderStatus.CANCELLED, updatedAt: now })
          .where(eq(orders.id, orderId));
        await addEvent(tx, {
          tenantId,
          orderId,
          actor: { actorType: ActorType.CUSTOMER, actorId: customerId },
          eventType: OrderEventType.CANCELLED,
        });
        log.info({ orderId, customerId, fromStatus: row.status }, '[order] cancelled by customer');
        return mapOrderRow({ ...row, status: OrderStatus.CANCELLED, updatedAt: now });
      });
    },

    /** Обработка вебхука оплаты (вызывается из payments route). */
    async applyPaymentResult(
      invoiceId: string,
      status: PaymentStatus,
      config: TenantConfig,
    ): Promise<void> {
      const rows = await db.select().from(orders).where(eq(orders.paymentInvoiceId, invoiceId)).limit(1);
      const row = rows[0];
      if (!row) {
        log.warn({ invoiceId, status }, '[payment] webhook for unknown invoice');
        throw AppError.notFound('Замовлення за invoiceId не знайдено');
      }

      log.info({ invoiceId, orderId: row.id, status }, '[payment] webhook received');

      if (status === PaymentStatus.PAID) {
        await finalizePaidOrder(row.id, config);
        return;
      }

      if (status === PaymentStatus.FAILED) {
        await db.transaction(async (tx: Tx) => {
          if (row.paymentStatus === PaymentStatus.PAID) return;
          await refundSpentAndEarned(tx, row, config);
          const now = new Date().toISOString();
          await tx
            .update(orders)
            .set({ status: OrderStatus.PAYMENT_FAILED, paymentStatus: PaymentStatus.FAILED, updatedAt: now })
            .where(eq(orders.id, row.id));
          await addEvent(tx, {
            tenantId: row.tenantId,
            orderId: row.id,
            actor: { actorType: ActorType.SYSTEM, actorId: null },
            eventType: OrderEventType.PAYMENT_FAILED,
          });
          log.warn({ orderId: row.id, invoiceId }, '[order] payment failed');
        });
      }
    },

    /** Переход статуса персоналом: accept / ready / cancel. */
    async staffTransition(
      tenantId: string,
      orderId: string,
      action: 'accept' | 'ready' | 'cancel',
      actor: ActorContext,
      config: TenantConfig,
    ): Promise<Order> {
      const updated = await db.transaction(async (tx: Tx) => {
        const rows = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)))
          .limit(1);
        const row = rows[0];
        if (!row) throw AppError.notFound('Замовлення не знайдено');

        const now = new Date().toISOString();
        let nextStatus: (typeof OrderStatus)[keyof typeof OrderStatus];
        let eventType: (typeof OrderEventType)[keyof typeof OrderEventType];

        if (action === 'accept') {
          if (row.status !== OrderStatus.PAID) throw AppError.conflict('Заказ можна прийняти лише після оплати');
          nextStatus = OrderStatus.ACCEPTED;
          eventType = OrderEventType.ACCEPTED;
        } else if (action === 'ready') {
          const allowed: string[] = [OrderStatus.ACCEPTED, OrderStatus.PREPARING];
          if (!allowed.includes(row.status)) throw AppError.conflict('Заказ ще не прийнято');
          nextStatus = OrderStatus.READY;
          eventType = OrderEventType.READY;
        } else {
          const allowed: string[] = [OrderStatus.PAID, OrderStatus.ACCEPTED, OrderStatus.PREPARING];
          if (!allowed.includes(row.status)) throw AppError.conflict('Заказ не можна скасувати');
          await refundSpentAndEarned(tx, row, config);
          nextStatus = OrderStatus.CANCELLED;
          eventType = OrderEventType.CANCELLED;
        }

        await tx.update(orders).set({ status: nextStatus, updatedAt: now }).where(eq(orders.id, orderId));
        await addEvent(tx, { tenantId, orderId, actor, eventType });
        log.info(
          { orderId, action, fromStatus: row.status, toStatus: nextStatus, actorId: actor.actorId },
          '[order] staff transition',
        );
        return mapOrderRow({ ...row, status: nextStatus, updatedAt: now });
      });

      const messages: Record<typeof action, string> = {
        accept: 'Ваше замовлення прийнято в роботу 👨‍🍳',
        ready: 'Ваше замовлення готове ✅',
        cancel: 'Ваше замовлення скасовано ❌',
      };
      const customerRows = await db
        .select({ telegramId: customers.telegramId })
        .from(customers)
        .where(eq(customers.id, updated.customerId))
        .limit(1);
      const telegramId = customerRows[0]?.telegramId;
      if (telegramId) {
        const shortId = updated.id.slice(0, 8);
        await notify.notifyCustomer(telegramId, `${messages[action]}\n#${shortId}`);
      }
      return updated;
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
