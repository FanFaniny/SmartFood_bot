# SmartFood — Telegram Mini App для закладів харчування

White-label шаблон для запуску онлайн-замовлень у кафе/ресторанах через Telegram:
клієнтський Mini App, Fastify API, SQLite, інтеграція з MonoPay, програма лояльності
та staff-флоу через Telegram-бота.

> Один код — багато закладів. Новий клієнт підключається через tenant-конфіг,
> seed-меню та змінні оточення, **без переписування коду**.

## Можливості

- 🧾 **Меню та кошик** — категорії, картки товарів (склад, вага/обʼєм, час приготування), опції «з собою / у закладі», алергени та побажання.
- 💳 **Оплата** — MonoPay (з dev-заглушкою для локальної розробки).
- ⭐ **Лояльність** — нарахування %, списання балами в межах ліміту, історія транзакцій.
- 👨‍🍳 **Staff-флоу** — нові замовлення приходять у Telegram з кнопками «Прийняти / Готово / Скасувати».
- 🔔 **Сповіщення клієнта** про зміну статусу замовлення.
- 🌐 **Локалізація uk-UA** за замовчуванням; брендинг і тема — через конфіг тенанта.

## Технології

- **Monorepo:** pnpm workspaces
- **Web App:** React 19, Vite, Tailwind CSS 4, TanStack Query, Zustand, `@telegram-apps`
- **API:** Node.js 22+, Fastify 5, Zod
- **DB:** SQLite (libsql) + Drizzle ORM
- **Bot:** grammY
- **Тести:** Vitest

## Структура

```text
SmartFood_bot/
├── apps/
│   ├── webapp/   # Telegram Mini App (клієнт)
│   ├── api/      # Fastify backend
│   └── bot/      # Telegram-бот для персоналу
├── packages/
│   ├── shared/   # типи, Zod-схеми, enums
│   ├── config/   # tenant-конфіги (бренд, тема, loyalty, payments, features)
│   ├── db/       # Drizzle schema, міграції, seed
│   └── telegram/ # валідація initData, helpers
└── docs/         # ARCHITECTURE.md, API.md, ADAPTATION.md
```

## Швидкий старт

### 1. Передумови

- Node.js **22+** (потрібен для `--env-file`)
- pnpm **10+**

### 2. Встановлення

```bash
pnpm install
```

### 3. Налаштування `.env`

Скопіюйте приклад і заповніть значення:

```bash
cp .env.example .env
```

Мінімум для локального запуску:

```ini
TELEGRAM_BOT_TOKEN=<токен від @BotFather>   # для бота та валідації initData
ALLOW_INSECURE_TELEGRAM_AUTH=true            # тестування у браузері поза Telegram
DB_AUTO_MIGRATE=true                         # авто-міграції при старті API
VITE_API_BASE_URL=http://localhost:3000      # звідки Web App ходить в API
```

> Секрети зберігаються **тільки** в `.env` (він у `.gitignore`), ніколи — у конфігах тенанта.

### 4. База даних: seed демо-меню

```bash
pnpm db:seed            # засіває tenant demo-cafe (4 категорії, 10 товарів)
```

### 5. Запуск (3 термінали або `pnpm dev`)

```bash
pnpm dev:api      # http://localhost:3000  (підхоплює .env автоматично)
pnpm dev:webapp   # http://localhost:5173  (ходить на API :3000)
pnpm dev:bot      # Telegram staff-бот
```

У браузері Web App працює завдяки `ALLOW_INSECURE_TELEGRAM_AUTH=true`
(використовується dev-заголовок замість справжнього Telegram initData).
Для запуску **всередині Telegram** потрібен публічний HTTPS-URL (тунель/деплой)
і вказаний Mini App URL у BotFather.

## Скрипти

| Команда | Опис |
| --- | --- |
| `pnpm dev` | усі застосунки паралельно |
| `pnpm dev:api` / `dev:webapp` / `dev:bot` | окремий застосунок |
| `pnpm build` | збірка всіх пакетів |
| `pnpm typecheck` | перевірка типів |
| `pnpm lint` / `lint:fix` | ESLint |
| `pnpm format` / `format:check` | Prettier |
| `pnpm test` | тести API (Vitest) |
| `pnpm db:migrate` / `db:seed` | міграції / seed |

## Тестування

```bash
pnpm test
```

- **Unit** — розрахунки лояльності та ціноутворення.
- **Інтеграційний smoke** — на тимчасовій SQLite: `create → оплата → нарахування балів → staff-перехід`.

## Документація

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — архітектура, потоки даних, життєвий цикл замовлення, логування.
- [docs/API.md](docs/API.md) — ендпоінти, авторизація, формати запитів/відповідей.
- [docs/ADAPTATION.md](docs/ADAPTATION.md) — як підключити нового клієнта.

## Деплой (коротко)

1. Зберіть проєкт: `pnpm build`.
2. Підготуйте `.env` з продакшн-значеннями (MonoPay-токен, `INTERNAL_API_SECRET`, `API_BASE_URL`, `ALLOW_INSECURE_TELEGRAM_AUTH=false`).
3. Запустіть API (`pnpm --filter @smartfood/api start`), віддайте `apps/webapp/dist` як статику через HTTPS.
4. У BotFather вкажіть Mini App URL та (за потреби) налаштуйте webhook бота.
5. Перевірте `GET /health`.
