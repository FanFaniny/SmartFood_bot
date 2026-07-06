import { createServer } from 'node:http';

import { loadDefaultTenantConfig } from '@smartfood/config';
import { Bot, InlineKeyboard, webhookCallback } from 'grammy';

import { createStaffApiClient, type StaffAction } from './api.js';
import { loadBotEnv } from './config.js';

const env = loadBotEnv();
const tenant = loadDefaultTenantConfig(env.DEFAULT_TENANT_ID);
const api = createStaffApiClient(env);

const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

const ACK_TEXT: Record<StaffAction, string> = {
  accept: 'Прийнято ✅',
  ready: 'Позначено готовим 🍽',
  cancel: 'Скасовано ❌',
};

const STATUS_FOOTER: Record<StaffAction, string> = {
  accept: '🟡 Статус: прийнято в роботу',
  ready: '🟢 Статус: готово',
  cancel: '🔴 Статус: скасовано',
};

/** После «Прийняти» показываем шаги «Готово/Скасувати»; ready/cancel — пустая клавиатура (кнопки убираются). */
function nextKeyboard(action: StaffAction, orderId: string): InlineKeyboard {
  if (action === 'accept') {
    return new InlineKeyboard()
      .text('🍽 Готово', `ready:${orderId}`)
      .row()
      .text('❌ Скасувати', `cancel:${orderId}`);
  }
  return new InlineKeyboard();
}

bot.command('start', async (ctx) => {
  await ctx.reply(
    [
      `👋 SmartFood Bot — ${tenant.venue.name}`,
      '',
      'Це службовий бот для персоналу. Нові замовлення приходять сюди з кнопками',
      '«Прийняти», «Готово», «Скасувати».',
      '',
      'Команди:',
      '/whoami — показати ваш Telegram ID (для додавання у персонал)',
    ].join('\n'),
  );
});

bot.command('whoami', async (ctx) => {
  const id = ctx.from?.id;
  await ctx.reply(
    [
      `Ваш Telegram ID: \`${id}\``,
      '',
      'Передайте цей ID адміністратору, щоб додати вас у `STAFF_TELEGRAM_IDS`.',
    ].join('\n'),
    { parse_mode: 'Markdown' },
  );
});

bot.callbackQuery(/^(accept|ready|cancel):(.+)$/, async (ctx) => {
  const action = ctx.match[1] as StaffAction;
  const orderId = ctx.match[2] as string;
  const staffTelegramId = ctx.from?.id;

  if (!staffTelegramId) {
    await ctx.answerCallbackQuery({ text: 'Не вдалося визначити користувача', show_alert: true });
    return;
  }

  const result = await api.staffAction(action, orderId, String(staffTelegramId));

  if (!result.ok) {
    await ctx.answerCallbackQuery({ text: result.message, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: ACK_TEXT[action] });

  const actorName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  const baseText = ctx.callbackQuery.message?.text ?? `Замовлення #${orderId.slice(0, 8)}`;
  const footer = `\n\n${STATUS_FOOTER[action]} · ${actorName}`;

  const keyboard = nextKeyboard(action, orderId);
  try {
    await ctx.editMessageText(baseText + footer, { reply_markup: keyboard });
  } catch (err) {
    // Сообщение могло быть слишком старым/идентичным — пробуем хотя бы обновить клавиатуру.
    console.warn('[bot] editMessageText failed:', err);
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    } catch {
      /* ignore */
    }
  }
});

bot.catch((err) => {
  console.error('[bot] error:', err.error);
});

async function start(): Promise<void> {
  if (env.BOT_MODE === 'webhook') {
    if (!env.TELEGRAM_WEBHOOK_URL) {
      throw new Error('BOT_MODE=webhook requires TELEGRAM_WEBHOOK_URL');
    }
    const handle = webhookCallback(bot, 'http', {
      ...(env.TELEGRAM_WEBHOOK_SECRET ? { secretToken: env.TELEGRAM_WEBHOOK_SECRET } : {}),
    });

    const server = createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'smartfood-bot' }));
        return;
      }
      void handle(req, res);
    });

    server.listen(env.BOT_PORT, env.BOT_HOST, () => {
      console.log(`[bot] webhook server on ${env.BOT_HOST}:${env.BOT_PORT}`);
    });

    await bot.api.setWebhook(env.TELEGRAM_WEBHOOK_URL, {
      ...(env.TELEGRAM_WEBHOOK_SECRET ? { secret_token: env.TELEGRAM_WEBHOOK_SECRET } : {}),
      allowed_updates: ['message', 'callback_query'],
    });
    console.log(
      `SmartFood Bot (webhook) for tenant "${tenant.tenantId}" → ${env.TELEGRAM_WEBHOOK_URL} (API: ${env.API_INTERNAL_URL})`,
    );
  } else {
    await bot.api.deleteWebhook();
    await bot.start({
      onStart: () =>
        console.log(
          `SmartFood Bot (polling) for tenant "${tenant.tenantId}" (API: ${env.API_INTERNAL_URL})`,
        ),
    });
  }
}

void start();
