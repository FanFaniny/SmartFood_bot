import { randomUUID } from 'node:crypto';

import { customers, type DatabaseClient } from '@smartfood/db';
import type { Customer } from '@smartfood/shared';
import type { TelegramWebAppUser } from '@smartfood/telegram';
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { and, eq } from 'drizzle-orm';

async function upsertCustomer(
  db: DatabaseClient,
  tenantId: string,
  tgUser: TelegramWebAppUser,
): Promise<Customer> {
  const telegramId = String(tgUser.id);
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.telegramId, telegramId)))
    .limit(1);

  if (existing[0]) {
    const row = existing[0];
    await db
      .update(customers)
      .set({
        firstName: tgUser.first_name,
        lastName: tgUser.last_name ?? null,
        username: tgUser.username ?? null,
        updatedAt: now,
      })
      .where(eq(customers.id, row.id));
    return {
      ...row,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name ?? null,
      username: tgUser.username ?? null,
      updatedAt: now,
    };
  }

  const created: Customer = {
    id: randomUUID(),
    tenantId,
    telegramId,
    firstName: tgUser.first_name,
    lastName: tgUser.last_name ?? null,
    username: tgUser.username ?? null,
    phone: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(customers).values(created);
  return created;
}

/** preHandler: создаёт/обновляет клиента по Telegram-пользователю и кладёт в request.customer. */
export function customerContext(app: FastifyInstance): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    request.customer = await upsertCustomer(app.db, app.tenantId, request.telegramUser);
  };
}
