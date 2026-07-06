import type { TelegramWebAppUser } from '@smartfood/telegram';
import { validateAndParseInitData, parseInitData } from '@smartfood/telegram';
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

import { AppError } from '../plugins/errors.js';

function extractInitData(request: FastifyRequest): string | null {
  const auth = request.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('tma ')) {
    return auth.slice(4).trim();
  }
  const header = request.headers['x-telegram-init-data'];
  if (typeof header === 'string' && header.length > 0) return header;
  return null;
}

/**
 * preHandler: проверяет Telegram initData и кладёт пользователя в request.telegramUser.
 * В insecure-режиме (только dev) допускает отсутствие/непроверенный initData.
 */
export function telegramAuth(app: FastifyInstance): preHandlerHookHandler {
  const { env } = app;

  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const raw = extractInitData(request);

    if (env.TELEGRAM_BOT_TOKEN && !env.allowInsecureTelegramAuth) {
      if (!raw) throw AppError.unauthorized('Відсутні дані авторизації Telegram');
      const result = validateAndParseInitData(raw, env.TELEGRAM_BOT_TOKEN);
      if (!result.ok) throw AppError.unauthorized(`Невірні дані Telegram (${result.reason})`);
      if (!result.data.user) throw AppError.unauthorized('У initData відсутній користувач');
      request.telegramUser = result.data.user;
      return;
    }

    // Insecure / dev режим.
    if (raw) {
      const parsed = parseInitData(raw);
      if (parsed?.user) {
        request.telegramUser = parsed.user;
        return;
      }
    }

    if (!env.allowInsecureTelegramAuth) {
      throw AppError.unauthorized('Авторизація Telegram недоступна');
    }

    const debugId = request.headers['x-debug-telegram-id'];
    const id = typeof debugId === 'string' && debugId.length > 0 ? Number(debugId) : 1;
    const debugUser: TelegramWebAppUser = {
      id: Number.isNaN(id) ? 1 : id,
      first_name: 'Dev',
      username: 'dev_user',
    };
    request.log.warn('[auth] using insecure dev Telegram user');
    request.telegramUser = debugUser;
  };
}
