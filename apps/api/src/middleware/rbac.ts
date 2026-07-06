import { staffMembers } from '@smartfood/db';
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { and, eq } from 'drizzle-orm';

import { AppError } from '../plugins/errors.js';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * preHandler для staff-эндпоинтов: проверяет общий секрет (X-Internal-Secret)
 * и наличие активного staff-аккаунта по Telegram ID (X-Staff-Telegram-Id).
 */
export function staffAuth(app: FastifyInstance): preHandlerHookHandler {
  const { env, db } = app;

  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const secret = request.headers['x-internal-secret'];

    if (!env.INTERNAL_API_SECRET) {
      if (env.isProduction) {
        throw AppError.forbidden('Staff API не налаштовано (немає INTERNAL_API_SECRET)');
      }
      request.log.warn('[staff] INTERNAL_API_SECRET not set — dev mode, secret check skipped');
    } else {
      if (typeof secret !== 'string' || !timingSafeEqual(secret, env.INTERNAL_API_SECRET)) {
        throw AppError.unauthorized('Невірний внутрішній секрет');
      }
    }

    const staffTelegramId = request.headers['x-staff-telegram-id'];
    if (typeof staffTelegramId !== 'string' || staffTelegramId.length === 0) {
      throw AppError.unauthorized('Відсутній X-Staff-Telegram-Id');
    }

    const rows = await db
      .select()
      .from(staffMembers)
      .where(and(eq(staffMembers.tenantId, app.tenantId), eq(staffMembers.telegramId, staffTelegramId)))
      .limit(1);

    const member = rows[0];
    if (!member || !member.isActive) {
      throw AppError.forbidden('Користувач не є активним співробітником');
    }

    request.staff = { id: member.id, telegramId: member.telegramId, role: member.role };
  };
}
