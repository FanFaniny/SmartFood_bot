import { STAFF_ROLE_VALUES, StaffRole } from '@smartfood/shared';
import { z } from 'zod';

type StaffRoleType = StaffRole;

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

export interface StaffSeedEntry {
  telegramId: string;
  role: StaffRoleType;
}

/** Парсит "12345:manager,67890" → [{telegramId,role}]. Роль по умолчанию — cook. */
function parseStaffIds(raw: string | undefined): StaffSeedEntry[] {
  if (!raw) return [];
  const roles = new Set<string>(STAFF_ROLE_VALUES);
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const [id, role] = part.split(':').map((s) => s.trim());
      const validRole = role && roles.has(role) ? (role as StaffRoleType) : StaffRole.COOK;
      return { telegramId: id as string, role: validRole };
    })
    .filter((entry) => entry.telegramId.length > 0);
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  API_PORT: z.coerce.number().int().positive().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  API_BASE_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().default('./data/smartfood.db'),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  DB_AUTO_MIGRATE: booleanFromEnv.optional(),

  DEFAULT_TENANT_ID: z.string().default('demo-cafe'),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_STAFF_CHAT_ID: z.string().optional(),

  /** Список staff Telegram ID, синхронизируется в staff_members при старте. */
  STAFF_TELEGRAM_IDS: z.string().optional(),

  MONOPAY_TOKEN: z.string().optional(),
  MONOPAY_WEBHOOK_URL: z.string().url().optional(),

  /** Общий секрет для вызовов staff-эндпоинтов из бота (заголовок X-Internal-Secret). */
  INTERNAL_API_SECRET: z.string().optional(),

  /** Разрешить непроверенный Telegram initData (только для локальной разработки). */
  ALLOW_INSECURE_TELEGRAM_AUTH: booleanFromEnv.optional(),

  /**
   * Включить dev-эндпоинты оплаты (HTML-checkout + ручное подтверждение) без реального MonoPay.
   * По умолчанию активны вне production. В production включаются ТОЛЬКО явно (для тестового стенда).
   */
  ALLOW_DEV_PAYMENTS: booleanFromEnv.optional(),
});

export type AppEnv = z.infer<typeof EnvSchema> & {
  isProduction: boolean;
  isDevelopment: boolean;
  allowInsecureTelegramAuth: boolean;
  allowDevPayments: boolean;
  dbAutoMigrate: boolean;
  staffMembers: StaffSeedEntry[];
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.parse(source);
  const isProduction = parsed.NODE_ENV === 'production';
  const isDevelopment = parsed.NODE_ENV === 'development';

  return {
    ...parsed,
    isProduction,
    isDevelopment,
    // По умолчанию небезопасный режим включён только вне production.
    allowInsecureTelegramAuth: parsed.ALLOW_INSECURE_TELEGRAM_AUTH ?? !isProduction,
    allowDevPayments: parsed.ALLOW_DEV_PAYMENTS ?? !isProduction,
    dbAutoMigrate: parsed.DB_AUTO_MIGRATE ?? isDevelopment,
    staffMembers: parseStaffIds(parsed.STAFF_TELEGRAM_IDS),
  };
}
