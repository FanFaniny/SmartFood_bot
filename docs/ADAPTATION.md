# Підключення нового клієнта (tenant)

Шаблон розрахований на запуск нового закладу **без зміни коду** — лише конфіг,
меню та змінні оточення. Нижче — покроковий чеклист.

## 1. Створити tenant-конфіг

Скопіюйте `packages/config/tenants/default.client.json` у файл з ідентифікатором клієнта,
напр. `coffee-lviv.client.json`:

```json
{
  "tenantId": "coffee-lviv",
  "venue": { "name": "Coffee Lviv", "locale": "uk-UA", "currency": "UAH" },
  "theme": {
    "mode": "telegram",                 // "telegram" — підлаштовується під тему клієнта; "custom" — фіксовані кольори
    "colors": { "primary": "#7c3aed", "background": "#ffffff", "surface": "#f5f3ff", "text": "#111827" }
  },
  "loyalty": { "earnRatePercent": 5, "pointToUah": 0.1, "maxSpendPercentOfOrder": 30 },
  "payments": { "provider": "monopay", "enabled": true },
  "features": { "loyalty": true, "drinkOptions": true, "staffTelegramFlow": true, "payments": true }
}
```

Конфіг валідовано схемою `TenantConfigSchema` (`packages/config/src/tenant.ts`).
Якщо файл `<tenantId>.client.json` відсутній — застосовується `default.client.json` (fallback).

### Поля

- **venue** — назва, локаль, валюта.
- **theme.mode** — `telegram` (кольори з Telegram themeParams) або `custom` (кольори з конфіга).
- **loyalty** — `earnRatePercent` (% нарахування), `pointToUah` (вартість балу в ₴), `maxSpendPercentOfOrder` (% оплати балами).
- **payments** — провайдер та `enabled`.
- **features** — фіче-флаги: `loyalty`, `drinkOptions`, `staffTelegramFlow`, `payments`. Вимкнений флаг ховає відповідний функціонал.

> Секрети (токени) у конфіг **не** кладемо — лише в `.env`.

## 2. Підготувати меню (seed)

Для MVP меню задається в `packages/db/src/seed.ts` (`DEMO_MENU`). Варіанти:

- **Швидко:** відредагуйте `DEMO_MENU` (категорії, товари, ціни, склад, вага/обʼєм, час приготування) під клієнта.
- **Чисто:** винесіть меню клієнта в окремий масив і передавайте `tenantId` при сіді.

Запуск сіду для тенанта:

```bash
pnpm db:seed --tenant=coffee-lviv
```

ID генеруються детерміновано: категорія — `${tenantId}-cat-${key}`, товар — `${tenantId}-prod-${key}`,
тож повторний сід ідемпотентний (оновлює існуючі записи).

## 3. Налаштувати `.env`

```ini
DEFAULT_TENANT_ID=coffee-lviv

TELEGRAM_BOT_TOKEN=<токен бота клієнта>
INTERNAL_API_SECRET=<довгий випадковий рядок>     # захист staff-ендпоінтів
STAFF_TELEGRAM_IDS=12345678:manager,87654321:cook # персонал (id або id:role)

MONOPAY_TOKEN=<токен MonoPay клієнта>
API_BASE_URL=https://api.coffee-lviv.example       # для редіректів/вебхуків
MONOPAY_WEBHOOK_URL=https://api.coffee-lviv.example/api/payments/monopay/webhook

ALLOW_INSECURE_TELEGRAM_AUTH=false                 # у production обовʼязково false
VITE_API_BASE_URL=https://api.coffee-lviv.example  # звідки Web App ходить в API
```

Ролі персоналу: `cook | barista | manager | admin` (за замовчуванням `cook`).
Персонал синхронізується в `staff_members` при старті API. Telegram ID можна дізнатися командою `/whoami` у боті.

## 4. Налаштувати Telegram (BotFather)

1. Створіть бота в [@BotFather](https://t.me/BotFather), отримайте токен → `TELEGRAM_BOT_TOKEN`.
2. Вкажіть Mini App URL (HTTPS, де хоститься `apps/webapp`).
3. Додайте кнопку меню / посилання на Mini App.
4. Додайте персонал у `STAFF_TELEGRAM_IDS` (їхні ID з `/whoami`).

## 5. Брендинг

- Кольори — у `theme.colors` (застосовуються як CSS-змінні `--color-*`).
- Для `mode: "telegram"` фон/текст/кнопки беруться з теми Telegram клієнта.
- Назва закладу та інші тексти — з `venue` і конфіга; мова за замовчуванням **uk-UA**
  (окремого i18n-фреймворку немає — один цільовий локаль; за потреби розширюється пізніше).

## 6. Перевірка

```bash
pnpm build && pnpm test     # збірка + тести
pnpm db:seed --tenant=<id>  # меню
pnpm dev:api & pnpm dev:webapp & pnpm dev:bot
```

- Відкрийте Web App → меню, кошик, оформлення, оплата (dev-checkout без MonoPay-токена).
- Перевірте, що персонал отримує замовлення в боті та змінює статус кнопками.
- `GET /health` повертає правильний `tenant`.

## 7. Деплой

1. `pnpm build`.
2. Запустіть API (`pnpm --filter @smartfood/api start`) з продакшн-`.env`.
3. Віддайте `apps/webapp/dist` як статику через HTTPS.
4. Налаштуйте webhook MonoPay на `MONOPAY_WEBHOOK_URL`.
5. У BotFather вкажіть фінальний Mini App URL.
