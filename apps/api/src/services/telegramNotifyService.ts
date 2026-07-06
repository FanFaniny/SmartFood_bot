import type { TenantConfig } from '@smartfood/config';
import type { Order, OrderItem } from '@smartfood/shared';
import { ServiceType } from '@smartfood/shared';
import type { FastifyBaseLogger } from 'fastify';

import type { AppEnv } from '../config/env.js';

function formatUah(cents: number): string {
  return (cents / 100).toFixed(2);
}

function serviceTypeLabel(type: OrderItem['serviceType']): string {
  if (type === ServiceType.DINE_IN) return 'у закладі';
  if (type === ServiceType.TAKEAWAY) return 'з собою';
  return '—';
}

export interface TelegramNotifyService {
  notifyStaffNewOrder(order: Order, items: OrderItem[], config: TenantConfig): Promise<void>;
  notifyCustomer(telegramId: string, text: string): Promise<void>;
}

export function createTelegramNotifyService(env: AppEnv, log: FastifyBaseLogger): TelegramNotifyService {
  const apiBase = env.TELEGRAM_BOT_TOKEN ? `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}` : null;

  async function callTelegram(method: string, payload: Record<string, unknown>): Promise<void> {
    if (!apiBase) {
      log.warn({ method, payload }, '[telegram] notify skipped (no TELEGRAM_BOT_TOKEN)');
      return;
    }
    try {
      const res = await fetch(`${apiBase}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        log.error({ method, status: res.status, body: await res.text() }, '[telegram] notify failed');
      }
    } catch (err) {
      log.error({ err, method }, '[telegram] notify error');
    }
  }

  return {
    async notifyStaffNewOrder(order, items, config) {
      if (!env.TELEGRAM_STAFF_CHAT_ID) {
        log.warn('[telegram] staff notify skipped (no TELEGRAM_STAFF_CHAT_ID)');
        return;
      }

      const shortId = order.id.slice(0, 8);
      const lines = items
        .map((it) => {
          const parts = [`• ${it.productSnapshot.name} ×${it.quantity} — ${formatUah(it.totalPriceUahCents)} грн`];
          parts.push(`   тип: ${serviceTypeLabel(it.serviceType)}`);
          if (it.allergensNote) parts.push(`   ⚠️ алергени: ${it.allergensNote}`);
          if (it.preferencesNote) parts.push(`   📝 побажання: ${it.preferencesNote}`);
          return parts.join('\n');
        })
        .join('\n');

      const text = [
        `🧾 *Нове замовлення* #${shortId}`,
        `🏪 ${config.venue.name}`,
        '',
        lines,
        '',
        `💰 Сума: *${formatUah(order.totalUahCents)} грн*`,
        order.customerNote ? `💬 Коментар: ${order.customerNote}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await callTelegram('sendMessage', {
        chat_id: env.TELEGRAM_STAFF_CHAT_ID,
        text,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Прийняти', callback_data: `accept:${order.id}` },
              { text: '🍽 Готово', callback_data: `ready:${order.id}` },
            ],
            [{ text: '❌ Скасувати', callback_data: `cancel:${order.id}` }],
          ],
        },
      });
    },

    async notifyCustomer(telegramId, text) {
      await callTelegram('sendMessage', { chat_id: telegramId, text, parse_mode: 'Markdown' });
    },
  };
}
