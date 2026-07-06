import { randomUUID } from 'node:crypto';

import type { TenantConfig } from '@smartfood/config';
import { loyaltyAccounts, loyaltyTransactions, type DatabaseClient } from '@smartfood/db';
import type { LoyaltySummary, LoyaltyTransaction } from '@smartfood/shared';
import { LoyaltyTransactionType } from '@smartfood/shared';
import { and, desc, eq } from 'drizzle-orm';

import type { Executor } from '../db-types.js';

/** Стоимость одного балла в копейках (UAH cents). */
export function pointValueCents(config: TenantConfig): number {
  return Math.round(config.loyalty.pointToUah * 100);
}

/** Сколько баллов начисляется за фактически оплаченную сумму (после скидки). */
export function computeEarnedPoints(paidTotalCents: number, config: TenantConfig): number {
  if (!config.features.loyalty) return 0;
  const pv = pointValueCents(config);
  if (pv <= 0) return 0;
  const earnedValueCents = Math.floor((paidTotalCents * config.loyalty.earnRatePercent) / 100);
  return Math.floor(earnedValueCents / pv);
}

/** Максимум баллов, которые можно списать в этом заказе. */
export function maxSpendablePoints(subtotalCents: number, balance: number, config: TenantConfig): number {
  if (!config.features.loyalty) return 0;
  const pv = pointValueCents(config);
  if (pv <= 0) return 0;
  const maxDiscountCents = Math.floor((subtotalCents * config.loyalty.maxSpendPercentOfOrder) / 100);
  const maxByDiscount = Math.floor(maxDiscountCents / pv);
  return Math.max(0, Math.min(balance, maxByDiscount));
}

export function pointsToDiscountCents(points: number, config: TenantConfig): number {
  return Math.max(0, points) * pointValueCents(config);
}

export interface LoyaltyService {
  getBalance(tenantId: string, customerId: string): Promise<number>;
  getSummary(tenantId: string, customerId: string, config: TenantConfig): Promise<LoyaltySummary>;
  listTransactions(tenantId: string, customerId: string, limit?: number): Promise<LoyaltyTransaction[]>;
  recordTransaction(
    exec: Executor,
    params: {
      tenantId: string;
      customerId: string;
      orderId: string | null;
      type: LoyaltyTransaction['type'];
      points: number;
      uahEquivalentCents: number;
    },
  ): Promise<void>;
}

export function createLoyaltyService(db: DatabaseClient): LoyaltyService {
  async function getBalance(tenantId: string, customerId: string): Promise<number> {
    const rows = await db
      .select({ balance: loyaltyAccounts.pointsBalance })
      .from(loyaltyAccounts)
      .where(and(eq(loyaltyAccounts.tenantId, tenantId), eq(loyaltyAccounts.customerId, customerId)))
      .limit(1);
    return rows[0]?.balance ?? 0;
  }

  return {
    getBalance,

    async getSummary(tenantId, customerId, config) {
      const balance = await getBalance(tenantId, customerId);
      return {
        pointsBalance: balance,
        uahEquivalentCents: pointsToDiscountCents(balance, config),
        earnRatePercent: config.loyalty.earnRatePercent,
        maxSpendPercentOfOrder: config.loyalty.maxSpendPercentOfOrder,
      };
    },

    async listTransactions(tenantId, customerId, limit = 50) {
      const rows = await db
        .select()
        .from(loyaltyTransactions)
        .where(and(eq(loyaltyTransactions.tenantId, tenantId), eq(loyaltyTransactions.customerId, customerId)))
        .orderBy(desc(loyaltyTransactions.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        customerId: r.customerId,
        orderId: r.orderId,
        type: r.type,
        points: r.points,
        uahEquivalentCents: r.uahEquivalentCents,
        createdAt: r.createdAt,
      }));
    },

    async recordTransaction(exec, params) {
      const now = new Date().toISOString();
      await exec.insert(loyaltyTransactions).values({
        id: randomUUID(),
        tenantId: params.tenantId,
        customerId: params.customerId,
        orderId: params.orderId,
        type: params.type,
        points: params.points,
        uahEquivalentCents: params.uahEquivalentCents,
        createdAt: now,
      });

      const existing = await exec
        .select({ id: loyaltyAccounts.id, balance: loyaltyAccounts.pointsBalance })
        .from(loyaltyAccounts)
        .where(and(eq(loyaltyAccounts.tenantId, params.tenantId), eq(loyaltyAccounts.customerId, params.customerId)))
        .limit(1);

      const delta = params.type === LoyaltyTransactionType.SPEND ? -params.points : params.points;

      if (existing[0]) {
        await exec
          .update(loyaltyAccounts)
          .set({ pointsBalance: existing[0].balance + delta, updatedAt: now })
          .where(eq(loyaltyAccounts.id, existing[0].id));
      } else {
        await exec.insert(loyaltyAccounts).values({
          id: randomUUID(),
          tenantId: params.tenantId,
          customerId: params.customerId,
          pointsBalance: Math.max(0, delta),
          updatedAt: now,
        });
      }
    },
  };
}
