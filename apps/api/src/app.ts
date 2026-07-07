import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { loadTenantConfig } from '@smartfood/config';
import { migrate, staffMembers, tenants } from '@smartfood/db';
import { and, eq } from 'drizzle-orm';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

import './types.js';
import type { AppEnv } from './config/env.js';
import { customerContext } from './middleware/customer.js';
import { staffAuth } from './middleware/rbac.js';
import { telegramAuth } from './middleware/telegramAuth.js';
import { createDb, registerDb } from './plugins/db.js';
import { registerErrorHandler } from './plugins/errors.js';
import { registerBootstrapRoutes } from './routes/bootstrap.js';
import { registerEventRoutes } from './routes/events.js';
import { registerLoyaltyRoutes } from './routes/loyalty.js';
import { registerMenuRoutes } from './routes/menu.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerPaymentRoutes } from './routes/payments.js';
import { registerStaffRoutes } from './routes/staff.js';
import { buildServices } from './services/index.js';

function ensureLocalDbDir(databaseUrl: string): void {
  if (databaseUrl.includes('://') && !databaseUrl.startsWith('file:')) return;
  const path = databaseUrl.replace(/^file:/, '');
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    /* ignore */
  }
}

async function ensureTenantRow(app: FastifyInstance): Promise<void> {
  const configJson = JSON.stringify(app.tenantConfig);
  await app.db
    .insert(tenants)
    .values({ id: app.tenantId, name: app.tenantConfig.venue.name, configJson })
    .onConflictDoUpdate({ target: tenants.id, set: { name: app.tenantConfig.venue.name, configJson } });
}

/** Синхронизирует staff из env (STAFF_TELEGRAM_IDS) в таблицу staff_members. */
async function syncStaffMembers(app: FastifyInstance): Promise<void> {
  const entries = app.env.staffMembers;
  if (entries.length === 0) return;

  for (const entry of entries) {
    const existing = await app.db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(and(eq(staffMembers.tenantId, app.tenantId), eq(staffMembers.telegramId, entry.telegramId)))
      .limit(1);

    if (existing[0]) {
      await app.db
        .update(staffMembers)
        .set({ role: entry.role, isActive: true })
        .where(eq(staffMembers.id, existing[0].id));
    } else {
      await app.db.insert(staffMembers).values({
        id: randomUUID(),
        tenantId: app.tenantId,
        telegramId: entry.telegramId,
        role: entry.role,
        isActive: true,
      });
    }
  }
  app.log.info(`[staff] synced ${entries.length} staff member(s) from STAFF_TELEGRAM_IDS`);
}

export async function buildApp(env: AppEnv): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  app.decorate('env', env);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
  });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  registerErrorHandler(app);

  ensureLocalDbDir(env.DATABASE_URL);
  if (env.dbAutoMigrate) {
    app.log.info('[db] running migrations (DB_AUTO_MIGRATE)');
    await migrate(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN ? { authToken: env.DATABASE_AUTH_TOKEN } : {});
  }

  const db = createDb(env);
  registerDb(app, db);

  const tenantConfig = loadTenantConfig(env.DEFAULT_TENANT_ID);
  app.decorate('tenantConfig', tenantConfig);
  app.decorate('tenantId', tenantConfig.tenantId);
  await ensureTenantRow(app);
  await syncStaffMembers(app);

  app.decorate('services', buildServices(env, db, app.log));
  app.decorate('eventHub', app.services.eventHub);

  const customerPreHandler = [telegramAuth(app), customerContext(app)];
  const staffPreHandler = [staffAuth(app)];

  app.get('/health', async () => ({ status: 'ok', service: 'smartfood-api', tenant: app.tenantId }));

  registerBootstrapRoutes(app, customerPreHandler);
  registerMenuRoutes(app, customerPreHandler);
  registerOrderRoutes(app, customerPreHandler);
  registerLoyaltyRoutes(app, customerPreHandler);
  registerPaymentRoutes(app, customerPreHandler);
  registerEventRoutes(app, customerPreHandler);
  registerStaffRoutes(app, staffPreHandler);

  app.log.info(
    {
      tenant: app.tenantId,
      venue: tenantConfig.venue.name,
      features: tenantConfig.features,
      paymentsProvider: tenantConfig.payments.provider,
      dbAutoMigrate: env.dbAutoMigrate,
      insecureTelegramAuth: env.allowInsecureTelegramAuth,
      devPayments: env.allowDevPayments,
      monopayConfigured: Boolean(env.MONOPAY_TOKEN),
      botTokenConfigured: Boolean(env.TELEGRAM_BOT_TOKEN),
    },
    '[startup] API configured',
  );

  if (env.isProduction && env.allowInsecureTelegramAuth) {
    app.log.warn('[security] ALLOW_INSECURE_TELEGRAM_AUTH is enabled in production — disable it!');
  }
  if (env.isProduction && !env.INTERNAL_API_SECRET) {
    app.log.warn('[security] INTERNAL_API_SECRET is not set — staff endpoints are unprotected!');
  }
  if (env.isProduction && env.allowDevPayments) {
    app.log.warn('[security] ALLOW_DEV_PAYMENTS is enabled in production — anyone can mark orders paid. Disable once MonoPay is live!');
  }
  if (!env.TELEGRAM_BOT_TOKEN) {
    app.log.warn('[startup] TELEGRAM_BOT_TOKEN not set — Telegram initData validation and notifications are limited');
  }

  return app;
}
