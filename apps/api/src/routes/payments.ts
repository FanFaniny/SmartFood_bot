import { orders } from '@smartfood/db';
import { PaymentStatus } from '@smartfood/shared';
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { AppError } from '../plugins/errors.js';

const InvoiceRequestSchema = z.object({ orderId: z.string().min(1) });

export function registerPaymentRoutes(app: FastifyInstance, customerPreHandler: preHandlerHookHandler[]): void {
  const { order } = app.services;

  // Создать/перевыпустить invoice для существующего заказа.
  app.post('/api/payments/monopay/invoice', { preHandler: customerPreHandler }, async (request) => {
    const body = InvoiceRequestSchema.parse(request.body);
    const invoice = await order.createInvoiceForExisting(
      app.tenantId,
      request.customer.id,
      body.orderId,
      app.tenantConfig,
    );
    return { payment: invoice };
  });

  // Webhook MonoPay (публичный). Подпись проверяется провайдером по мере поддержки.
  app.post('/api/payments/monopay/webhook', async (request, reply) => {
    const event = app.services.payment.parseWebhook(request.body);
    await order.applyPaymentResult(event.invoiceId, event.status, app.tenantConfig);
    reply.status(200);
    return { ok: true };
  });

  // Dev-инструменты для тестирования без реального MonoPay.
  if (app.env.allowDevPayments) {
    app.get<{ Params: { orderId: string } }>('/api/payments/dev/checkout/:orderId', async (request, reply) => {
      const { orderId } = request.params;
      reply.type('text/html');
      return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>Dev checkout</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;text-align:center">
<h2>Тестова оплата</h2><p>Замовлення <code>${orderId}</code></p>
<button id="pay" style="padding:12px 24px;font-size:16px">Підтвердити оплату</button>
<p id="status"></p>
<script>
document.getElementById('pay').onclick = async () => {
  const r = await fetch('/api/payments/dev/confirm/${orderId}', { method: 'POST' });
  document.getElementById('status').textContent = r.ok ? 'Оплачено ✅' : 'Помилка';
};
</script></body></html>`;
    });

    app.post<{ Params: { orderId: string } }>('/api/payments/dev/confirm/:orderId', async (request) => {
      const rows = await app.db
        .select({ invoiceId: orders.paymentInvoiceId })
        .from(orders)
        .where(eq(orders.id, request.params.orderId))
        .limit(1);
      const invoiceId = rows[0]?.invoiceId;
      if (!invoiceId) throw AppError.notFound('Invoice для замовлення не знайдено');
      await order.applyPaymentResult(invoiceId, PaymentStatus.PAID, app.tenantConfig);
      return { ok: true };
    });
  }
}
