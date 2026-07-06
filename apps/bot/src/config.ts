import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  API_INTERNAL_URL: z.string().url().default('http://localhost:3000'),
  INTERNAL_API_SECRET: z.string().optional(),
  DEFAULT_TENANT_ID: z.string().default('demo-cafe'),

  /** Режим работы бота: long polling (по умолчанию) или webhook. */
  BOT_MODE: z.enum(['polling', 'webhook']).default('polling'),
  /** Публичный HTTPS-URL вебхука, напр. https://domain/telegram/webhook (для BOT_MODE=webhook). */
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
  /** Секрет, проверяемый по заголовку X-Telegram-Bot-Api-Secret-Token. */
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  /** Порт/хост локального HTTP-сервера вебхука (за reverse-proxy). */
  BOT_PORT: z.coerce.number().int().positive().default(8081),
  BOT_HOST: z.string().default('0.0.0.0'),
});

export type BotEnv = z.infer<typeof EnvSchema>;

export function loadBotEnv(source: NodeJS.ProcessEnv = process.env): BotEnv {
  return EnvSchema.parse(source);
}
