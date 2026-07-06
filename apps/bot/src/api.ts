import type { Order } from '@smartfood/shared';

import type { BotEnv } from './config.js';

export type StaffAction = 'accept' | 'ready' | 'cancel';

export type StaffActionResult =
  | { ok: true; order: Order }
  | { ok: false; status: number; message: string };

export interface StaffApiClient {
  staffAction(action: StaffAction, orderId: string, staffTelegramId: string): Promise<StaffActionResult>;
}

export function createStaffApiClient(env: BotEnv): StaffApiClient {
  const baseUrl = env.API_INTERNAL_URL.replace(/\/$/, '');

  return {
    async staffAction(action, orderId, staffTelegramId) {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'X-Staff-Telegram-Id': staffTelegramId,
      };
      if (env.INTERNAL_API_SECRET) headers['X-Internal-Secret'] = env.INTERNAL_API_SECRET;

      let res: Response;
      try {
        res = await fetch(`${baseUrl}/api/staff/orders/${orderId}/${action}`, {
          method: 'POST',
          headers,
          body: '{}',
        });
      } catch (err) {
        return { ok: false, status: 0, message: `Немає зв'язку з API: ${(err as Error).message}` };
      }

      const data = (await res.json().catch(() => null)) as
        | { order?: Order; error?: { message?: string } }
        | null;

      if (!res.ok || !data?.order) {
        return {
          ok: false,
          status: res.status,
          message: data?.error?.message ?? `Помилка API (${res.status})`,
        };
      }
      return { ok: true, order: data.order };
    },
  };
}
