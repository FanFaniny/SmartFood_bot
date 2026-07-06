# Архітектура

## Огляд

SmartFood — це white-label monorepo: спільний код обслуговує багатьох клієнтів (tenants).
Конкретний заклад визначається `tenant`-конфігом, seed-меню та змінними оточення.

```text
Клієнт (Telegram Mini App)                Персонал (Telegram-бот)
        │  initData (HMAC)                        │  X-Internal-Secret + Staff Telegram ID
        ▼                                         ▼
┌──────────────────────────── Fastify API ────────────────────────────┐
│  middleware: telegramAuth → customerContext   |   staffAuth (RBAC)   │
│  services:   order · loyalty · payment(MonoPay) · telegramNotify     │
└───────────────────────────────┬─────────────────────────────────────┘
                                 ▼
                       SQLite (libsql) + Drizzle ORM
```

## Пакети та застосунки

| Пакет | Призначення |
| --- | --- |
| `apps/webapp` | React Mini App: меню, кошик, оплата, лояльність, замовлення |
| `apps/api` | Fastify API: меню, замовлення, лояльність, платежі, staff |
| `apps/bot` | grammY-бот для персоналу (inline-кнопки статусів) |
| `packages/shared` | TypeScript-типи, Zod-схеми, enums — єдине джерело правди |
| `packages/config` | tenant-конфіги (бренд, тема, loyalty, payments, features) + Zod-валідація |
| `packages/db` | Drizzle schema, міграції, seed, клієнт |
| `packages/telegram` | валідація/парсинг Telegram `initData`, helpers |

## Tenant-модель

- Усі core-сутності містять `tenant_id` (навіть якщо клієнт поки один).
- Бізнес-налаштування — у `packages/config/tenants/<id>.client.json` (з fallback на `default.client.json`).
- Секрети — **тільки** в `.env`.
- Конфіг тенанта валідовано схемою `TenantConfigSchema` (`packages/config/src/tenant.ts`):
  `venue`, `theme`, `loyalty`, `payments`, `features`.

## Авторизація

### Клієнт (Web App → API)

- У Telegram: заголовок `Authorization: tma <initDataRaw>`; підпис перевіряється HMAC-ключем від `TELEGRAM_BOT_TOKEN` (`packages/telegram`).
- Dev поза Telegram: за `ALLOW_INSECURE_TELEGRAM_AUTH=true` приймається заголовок `X-Debug-Telegram-Id`.
- `customerContext` робить upsert клієнта і додає `request.customer`.

### Персонал (Bot → API)

- `staffAuth` перевіряє `X-Internal-Secret` (порівняння через `timingSafeEqual`) та `X-Staff-Telegram-Id`.
- Telegram ID має існувати в `staff_members` (активний). Персонал синхронізується з `STAFF_TELEGRAM_IDS` при старті API.

## Життєвий цикл замовлення

```text
draft → pending_payment → paid → accepted → preparing → ready → completed
                   │                                  
                   ├─ payment_failed (невдала оплата)
                   └─ cancelled (клієнт або персонал)
```

- **preview** — сервер перераховує кошик за цінами з БД (frontend-цінам не довіряємо), рахує знижку балами та майбутні бали.
- **create** — у транзакції: створення `orders` + `order_items` (зі снапшотом товару), списання балів, подія `created`; далі — створення invoice (MonoPay або dev-заглушка).
- **Оплата** — webhook `applyPaymentResult`: при `paid` нараховуються бали та надсилається сповіщення персоналу (ідемпотентно).
- **staffTransition** — `accept/ready/cancel` з перевіркою допустимих переходів; клієнту йде сповіщення.
- Усі ключові дії пишуться в `order_events` (для відлагодження та майбутньої аналітики).

## Лояльність

Логіка — у `loyaltyService` (`apps/api/src/services/loyaltyService.ts`):

- `pointValueCents` = `pointToUah * 100` (вартість балу в копійках);
- `computeEarnedPoints` = `floor(floor(сума * earnRatePercent / 100) / pointValueCents)`;
- `maxSpendablePoints` обмежено `maxSpendPercentOfOrder` та балансом;
- транзакції типів `earn / spend / refund / adjustment`; баланс зберігається в `loyalty_accounts`.

## Платежі (MonoPay)

`paymentService`:

- `createInvoice` — створює рахунок у MonoPay; без `MONOPAY_TOKEN` повертає **dev-заглушку** з URL `/api/payments/dev/checkout/:orderId`.
- `parseWebhook` — нормалізує статуси (`success → paid`, `failure/expired/reversed → failed`).
- Dev-ендпоінти `/api/payments/dev/checkout|confirm` доступні лише поза production.

## Логування та спостережуваність

- Fastify (pino) логує всі HTTP-запити; рівень — `LOG_LEVEL`.
- Доменні події `orderService` логуються структуровано: `[order] created`, `payment invoice created`, `paid & finalized`, `staff transition`, `cancelled by customer`, `[payment] webhook received`.
- При старті — зведення конфігурації `[startup] API configured` + попередження безпеки (insecure auth/немає `INTERNAL_API_SECRET` у production).
- `GET /health` — health-check.

## Цілісність даних

- Критичні операції — у `db.transaction()` (атомарність створення/оплати/скасування).
- Seed та обробка оплати ідемпотентні (повторний запуск безпечний).
