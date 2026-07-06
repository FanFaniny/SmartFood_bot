import { createHmac } from 'node:crypto';

export type TelegramWebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type ParsedInitData = {
  user?: TelegramWebAppUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  start_param?: string;
};

/**
 * Проверяет подпись Telegram initData по алгоритму Mini Apps:
 * secret = HMAC_SHA256("WebAppData", botToken); hash = HMAC_SHA256(secret, dataCheckString).
 */
export function validateInitData(initData: string, botToken: string): boolean {
  if (!initData || !botToken) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;

  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return calculatedHash === hash;
}

/** Парсит строку initData в объект (без проверки подписи). */
export function parseInitData(initData: string): ParsedInitData | null {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDateRaw = params.get('auth_date');
  if (!hash || !authDateRaw) return null;

  const result: ParsedInitData = {
    auth_date: Number(authDateRaw),
    hash,
  };

  const userRaw = params.get('user');
  if (userRaw) {
    try {
      result.user = JSON.parse(userRaw) as TelegramWebAppUser;
    } catch {
      return null;
    }
  }

  const queryId = params.get('query_id');
  if (queryId) result.query_id = queryId;

  const startParam = params.get('start_param');
  if (startParam) result.start_param = startParam;

  return result;
}

export type ValidateOptions = {
  /** Максимальный возраст initData в секундах (защита от replay). 0 — не проверять. */
  maxAgeSeconds?: number;
};

export type ValidationResult =
  | { ok: true; data: ParsedInitData }
  | { ok: false; reason: 'empty' | 'malformed' | 'bad_signature' | 'expired' };

/** Проверяет подпись и срок действия, затем возвращает распарсенные данные. */
export function validateAndParseInitData(
  initData: string,
  botToken: string,
  options: ValidateOptions = {},
): ValidationResult {
  if (!initData || !botToken) return { ok: false, reason: 'empty' };

  const parsed = parseInitData(initData);
  if (!parsed || Number.isNaN(parsed.auth_date)) return { ok: false, reason: 'malformed' };

  if (!validateInitData(initData, botToken)) return { ok: false, reason: 'bad_signature' };

  const maxAge = options.maxAgeSeconds ?? 86_400;
  if (maxAge > 0) {
    const ageSeconds = Math.floor(Date.now() / 1000) - parsed.auth_date;
    if (ageSeconds > maxAge) return { ok: false, reason: 'expired' };
  }

  return { ok: true, data: parsed };
}
