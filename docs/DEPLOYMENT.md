# Розгортання (Deployment)

Production-деплой одним сервером: **VPS + Docker Compose + Caddy** (автоматичний HTTPS).
Один домен обслуговує все:

- `https://<domain>/` — Telegram Mini App (статика);
- `https://<domain>/api/*` — API (Fastify), у т.ч. MonoPay webhook;
- `https://<domain>/telegram/webhook` — webhook Telegram-бота.

Бот працює в режимі **webhook**, дані зберігаються в SQLite на Docker-volume.

---

## 1. Передумови

- VPS (Ubuntu 22.04/24.04 або інший Linux), 1 vCPU / 1 GB RAM достатньо для MVP.
- Встановлені **Docker** і плагін **Docker Compose v2**:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- Відкриті порти **80** і **443**.
- **Домен** з A-записом на IP сервера.
  - Telegram Mini App і webhook вимагають валідний HTTPS-сертифікат, тому «голий» IP не підійде (Let's Encrypt не видає сертифікати на IP).
  - Якщо власного домену немає — підійде безкоштовний піддомен (напр. [DuckDNS](https://www.duckdns.org/)): створіть `your-name.duckdns.org` → IP сервера і використовуйте його як `DOMAIN`.

---

## 2. Налаштування

```bash
git clone <repo-url> smartfood && cd smartfood
cp .env.production.example .env
```

Відредагуйте `.env` (мінімум):

| Змінна | Опис |
| --- | --- |
| `DOMAIN` | ваш домен, напр. `food.example.com` |
| `TELEGRAM_BOT_TOKEN` | токен від @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | довгий випадковий рядок |
| `INTERNAL_API_SECRET` | довгий випадковий рядок (бот → staff API) |
| `STAFF_TELEGRAM_IDS` | напр. `12345678:manager,87654321:cook` |
| `MONOPAY_TOKEN` | токен MonoPay (порожньо → dev-заглушка) |
| `DEFAULT_TENANT_ID` | `demo-cafe` за замовчуванням |

Згенерувати секрети:

```bash
openssl rand -hex 32
```

> `API_BASE_URL`, `CORS_ORIGIN`, `MONOPAY_WEBHOOK_URL`, `TELEGRAM_WEBHOOK_URL`,
> `BOT_MODE`, `DATABASE_URL` та порти підставляються автоматично в `docker-compose.yml`
> на основі `DOMAIN`.

---

## 3. Запуск

```bash
docker compose up -d --build
```

Перевірка:

```bash
docker compose ps
docker compose logs -f api bot caddy
curl https://<domain>/health     # очікується {"status":"ok",...}
```

Caddy сам отримає TLS-сертифікат при першому запиті (потрібні робочі 80/443 і коректна DNS-запис).

---

## 4. Наповнення меню (seed)

Міграції БД виконуються автоматично при старті API (`DB_AUTO_MIGRATE=true`).
Demo-меню заливаємо разово:

```bash
docker compose exec api node node_modules/@smartfood/db/dist/seed-cli.js --tenant=demo-cafe
```

Реальне меню — відредагуйте seed/конфіг тенанта (див. [ADAPTATION.md](./ADAPTATION.md)) і повторіть команду.

---

## 5. Налаштування Telegram

У @BotFather:

1. **Bot Settings → Menu Button → Configure menu button** → URL = `https://<domain>/`.
2. (Опц.) **Mini App**: додайте те саме посилання.

Webhook бота встановлюється автоматично при старті контейнера `bot`
(на `https://<domain>/telegram/webhook` з `TELEGRAM_WEBHOOK_SECRET`).
Перевірити:

```bash
curl "https://api.telegram.org/bot<token>/getWebhookInfo"
```

Дізнатися свій Telegram ID для `STAFF_TELEGRAM_IDS` — командою `/whoami` у боті
(після оновлення `.env` перезапустіть API: `docker compose up -d api`).

---

## 6. Оплата

**Реальний MonoPay:**

- Заповніть `MONOPAY_TOKEN` у `.env`, `ALLOW_DEV_PAYMENTS=false`.
- URL вебхука — `https://<domain>/api/payments/monopay/webhook` (підставляється автоматично),
  додаткова реєстрація в кабінеті MonoPay зазвичай не потрібна (передається при створенні інвойсу).

**Тестовий стенд без MonoPay (заглушка):**

- Залиште `MONOPAY_TOKEN` порожнім і встановіть `ALLOW_DEV_PAYMENTS=true`.
- Тоді оплата відкриває просту HTML-сторінку з кнопкою «Оплатити», яка вручну позначає
  замовлення оплаченим — зручно перевірити весь цикл.
- ⚠️ У цьому режимі будь-хто може позначити замовлення оплаченим. Вимкніть (`false`),
  щойно підключите справжній MonoPay.

---

## 7. Оновлення версії

```bash
git pull
docker compose up -d --build
```

Образи пересобираються, контейнери перезапускаються; volume з БД зберігається.

---

## 8. Резервне копіювання БД

Дані лежать у Docker volume `sqlite-data` (`/data/smartfood.db`).

```bash
# бекап
docker compose exec api sh -c "cat /data/smartfood.db" > backup-$(date +%F).db

# або копіювання volume цілком
docker run --rm -v smartfood_sqlite-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/sqlite-backup.tgz -C /data .
```

---

## 9. Типові проблеми

| Симптом | Причина / рішення |
| --- | --- |
| Caddy не видає сертифікат | DNS не вказує на сервер, або зайняті порти 80/443. Перевірте `docker compose logs caddy`. |
| Mini App не відкривається | URL у BotFather має бути `https://<domain>/` з валідним TLS. |
| Webhook не приходить | `getWebhookInfo` покаже помилку; перевірте `TELEGRAM_WEBHOOK_SECRET` і логи `bot`. |
| 401 на staff-діях | Не збігається `INTERNAL_API_SECRET` між `bot` і `api`. |
| Порожнє меню | Не виконано seed (крок 4). |

---

## Альтернативи

- **PaaS (Railway / Render / Fly.io)**: розгорнути `api` та `bot` як окремі сервіси з тих самих
  Docker-таргетів (`target: api`, `target: bot`), webapp — як статичний сайт; HTTPS надає платформа.
- **VPS вручну (systemd + nginx + certbot)**: збирати через `pnpm -r build` + `pnpm --filter <app> --legacy deploy --prod`,
  запускати `node dist/index.js` під systemd, nginx як reverse proxy.

За потреби допоможу налаштувати будь-який із цих варіантів.
