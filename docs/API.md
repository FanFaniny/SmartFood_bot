# API

Базовий URL за замовчуванням: `http://localhost:3000`.
Усі грошові суми — **цілі в копійках** (UAH cents). Дати — рядки ISO-8601.

## Авторизація

### Клієнтські ендпоінти (`/api/...`)

Потрібен один із заголовків:

- `Authorization: tma <initDataRaw>` — усередині Telegram (підпис перевіряється за `TELEGRAM_BOT_TOKEN`);
- `X-Debug-Telegram-Id: <id>` — лише в dev (`ALLOW_INSECURE_TELEGRAM_AUTH=true`).

### Staff-ендпоінти (`/api/staff/...`)

- `X-Internal-Secret: <INTERNAL_API_SECRET>`
- `X-Staff-Telegram-Id: <telegram id>` (має бути активним у `staff_members`).

## Формат помилок

```json
{ "error": { "code": "bad_request", "message": "Опис помилки" } }
```

Коди статусів: `400` (валідація/бізнес), `401/403` (авторизація), `404`, `409` (конфлікт стану), `502` (платіжний провайдер).

---

## Клієнт

### `GET /api/app/bootstrap`
Початкові дані застосунку.
```json
{
  "tenant": { "tenantId": "demo-cafe", "venue": {…}, "theme": {…}, "features": {…}, "loyalty": {…} },
  "customer": { "id": "…", "telegramId": "…", "firstName": "…", "lastName": null, "username": "…" },
  "loyalty": { "pointsBalance": 0, "uahEquivalentCents": 0, "earnRatePercent": 5, "maxSpendPercentOfOrder": 30 }
}
```

### `GET /api/menu`
```json
{ "categories": [ { "id": "…", "name": "Кава", "sortOrder": 1, "products": [ Product, … ] } ] }
```

### `GET /api/menu/products/:id`
```json
{ "product": { "id": "…", "name": "Еспресо", "priceUahCents": 4500, "measureValue": 40, "measureUnit": "ml", "avgPrepTimeMinutes": 3, … } }
```

### `POST /api/orders/preview`
Перерахунок кошика на сервері (ціни з БД).
```json
// запит
{ "items": [ { "productId": "demo-cafe-prod-espresso", "quantity": 2, "serviceType": "takeaway", "allergensNote": "…", "preferencesNote": "…" } ], "pointsToSpend": 0 }
// відповідь
{ "lines": […], "subtotalUahCents": 9000, "loyaltyPointsSpent": 0, "loyaltyDiscountUahCents": 0, "totalUahCents": 9000, "loyaltyPointsEarned": 45, "maxLoyaltyPointsSpendable": 0 }
```

### `POST /api/orders`  → `201`
Тіло як у `preview` + опційне `customerNote`.
```json
{ "order": { "id": "…", "status": "pending_payment", … }, "items": [ OrderItem, … ], "payment": { "invoiceId": "…", "pageUrl": "…" } }
```
`payment` присутній, якщо `features.payments` увімкнено. Клієнт відкриває `pageUrl`.

### `GET /api/orders`
```json
{ "orders": [ Order, … ] }   // останні 50, від нових до старих
```

### `GET /api/orders/:id`
```json
{ "order": { …Order, "items": [ OrderItem, … ] } }
```

### `POST /api/orders/:id/cancel`
Скасування клієнтом (дозволено для `pending_payment` / `paid`). Повертає `{ "order": Order }`. Списані/нараховані бали повертаються.

### `GET /api/loyalty`
```json
{ "summary": { "pointsBalance": 45, "uahEquivalentCents": 450, "earnRatePercent": 5, "maxSpendPercentOfOrder": 30 }, "transactions": [ LoyaltyTransaction, … ] }
```

### `POST /api/payments/monopay/invoice`
Перевипуск рахунку для наявного `pending_payment`-замовлення.
```json
// запит
{ "orderId": "…" }
// відповідь
{ "payment": { "invoiceId": "…", "pageUrl": "…" } }
```

---

## Публічні

### `POST /api/payments/monopay/webhook`
Webhook MonoPay. Нормалізує статус і застосовує його до замовлення. Відповідь `{ "ok": true }`.

### `GET /health`
```json
{ "status": "ok", "service": "smartfood-api", "tenant": "demo-cafe" }
```

---

## Staff

### `GET /api/staff/orders/active`
```json
{ "orders": [ { …Order, "items": [ … ] } ] }   // paid / accepted / preparing / ready
```

### `POST /api/staff/orders/:id/accept`
### `POST /api/staff/orders/:id/ready`
### `POST /api/staff/orders/:id/cancel`
Зміна статусу персоналом. Тіло `{}`. Повертає `{ "order": Order }`.
Допустимі переходи: `accept` лише з `paid`; `ready` з `accepted/preparing`; `cancel` з `paid/accepted/preparing`.

---

## Dev-ендпоінти (лише поза production)

- `GET /api/payments/dev/checkout/:orderId` — тестова сторінка оплати.
- `POST /api/payments/dev/confirm/:orderId` — підтвердити оплату (емуляція webhook `paid`).
