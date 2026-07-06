import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadTenantConfig, type TenantConfig } from '@smartfood/config';
import { createDbClient, customers, migrate, seed, type DatabaseClient } from '@smartfood/db';
import { OrderStatus, PaymentStatus } from '@smartfood/shared';
import type { FastifyBaseLogger } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../dist/config/env.js';
import { buildServices, type AppServices } from '../dist/services/index.js';

const TENANT = 'demo-cafe';
const ESPRESSO = `${TENANT}-prod-espresso`; // 45.00 ₴
const CAPPUCCINO = `${TENANT}-prod-cappuccino`; // 65.00 ₴

const noop = () => undefined;
const log = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  fatal: noop,
  trace: noop,
  level: 'silent',
  silent: noop,
  child() {
    return log;
  },
} as unknown as FastifyBaseLogger;

let dbDir: string;
let db: DatabaseClient;
let services: AppServices;
let config: TenantConfig;
const customerId = randomUUID();

beforeAll(async () => {
  dbDir = mkdtempSync(join(tmpdir(), 'smartfood-test-'));
  const dbPath = join(dbDir, 'test.db');

  await migrate(dbPath);
  await seed(dbPath, { tenantId: TENANT });

  db = createDbClient(dbPath);
  config = loadTenantConfig(TENANT);
  const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: dbPath, DEFAULT_TENANT_ID: TENANT });
  services = buildServices(env, db, log);

  await db.insert(customers).values({ id: customerId, tenantId: TENANT, telegramId: '777000' });
});

afterAll(() => {
  db?.$client.close();
  if (!dbDir) return;
  // На Windows libsql может не сразу освободить файл — чистка best-effort.
  try {
    rmSync(dbDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    /* временную папку уберёт ОС */
  }
});

describe('order lifecycle', () => {
  let orderId: string;
  let invoiceId: string;

  it('preview пересчитывает корзину по ценам из БД', async () => {
    const preview = await services.order.preview(
      TENANT,
      customerId,
      { items: [{ productId: ESPRESSO, quantity: 2 }], pointsToSpend: 0 },
      config,
    );
    expect(preview.subtotalUahCents).toBe(9_000);
    expect(preview.totalUahCents).toBe(9_000);
    expect(preview.loyaltyPointsSpent).toBe(0);
    expect(preview.loyaltyPointsEarned).toBe(45);
  });

  it('создаёт заказ в статусе ожидания оплаты с invoice', async () => {
    const created = await services.order.create(
      TENANT,
      customerId,
      { items: [{ productId: ESPRESSO, quantity: 2 }], pointsToSpend: 0 },
      config,
    );
    expect(created.order.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(created.payment?.invoiceId).toBeTruthy();
    orderId = created.order.id;
    invoiceId = created.payment!.invoiceId;
  });

  it('оплата начисляет баллы и переводит в paid', async () => {
    await services.order.applyPaymentResult(invoiceId, PaymentStatus.PAID, config);
    const paid = await services.order.getById(TENANT, customerId, orderId);
    expect(paid.status).toBe(OrderStatus.PAID);
    expect(paid.loyaltyPointsEarned).toBe(45);

    const balance = await services.loyalty.getBalance(TENANT, customerId);
    expect(balance).toBe(45);
  });

  it('списание баллов ограничено балансом и % от заказа', async () => {
    // subtotal 65.00 ₴, max 30% = 19.50 ₴ -> 195 балів, но баланс 45
    const preview = await services.order.preview(
      TENANT,
      customerId,
      { items: [{ productId: CAPPUCCINO, quantity: 1 }], pointsToSpend: 1_000 },
      config,
    );
    expect(preview.maxLoyaltyPointsSpendable).toBe(45);
    expect(preview.loyaltyPointsSpent).toBe(45);
    expect(preview.loyaltyDiscountUahCents).toBe(450);
    expect(preview.totalUahCents).toBe(6_050);
  });

  it('staff переводит заказ accept -> ready', async () => {
    const accepted = await services.order.staffTransition(
      TENANT,
      orderId,
      'accept',
      { actorType: 'staff', actorId: 'staff-1' },
      config,
    );
    expect(accepted.status).toBe(OrderStatus.ACCEPTED);

    const ready = await services.order.staffTransition(
      TENANT,
      orderId,
      'ready',
      { actorType: 'staff', actorId: 'staff-1' },
      config,
    );
    expect(ready.status).toBe(OrderStatus.READY);
  });

  it('нельзя отменить уже готовый заказ', async () => {
    await expect(
      services.order.cancelByCustomer(TENANT, customerId, orderId, config),
    ).rejects.toThrow();
  });
});
