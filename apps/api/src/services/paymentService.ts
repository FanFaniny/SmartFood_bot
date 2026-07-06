import type { TenantConfig } from '@smartfood/config';
import type { Order } from '@smartfood/shared';
import { PaymentStatus } from '@smartfood/shared';
import type { FastifyBaseLogger } from 'fastify';

import type { AppEnv } from '../config/env.js';
import { AppError } from '../plugins/errors.js';

const MONOPAY_API = 'https://api.monobank.ua/api/merchant';
const CCY_UAH = 980;

export interface InvoiceResult {
  invoiceId: string;
  pageUrl: string;
}

export type NormalizedPaymentStatus =
  | typeof PaymentStatus.PAID
  | typeof PaymentStatus.FAILED
  | typeof PaymentStatus.PROCESSING;

export interface WebhookEvent {
  invoiceId: string;
  status: NormalizedPaymentStatus;
  reference?: string;
}

/** Сырое тело вебхука MonoPay (минимально нужные поля). */
interface MonoWebhookBody {
  invoiceId?: string;
  status?: string;
  reference?: string;
}

function mapMonoStatus(status: string | undefined): NormalizedPaymentStatus {
  switch (status) {
    case 'success':
      return PaymentStatus.PAID;
    case 'failure':
    case 'expired':
    case 'reversed':
      return PaymentStatus.FAILED;
    default:
      return PaymentStatus.PROCESSING;
  }
}

export interface PaymentService {
  readonly enabled: boolean;
  createInvoice(order: Order, config: TenantConfig): Promise<InvoiceResult>;
  parseWebhook(body: unknown): WebhookEvent;
}

export function createPaymentService(env: AppEnv, log: FastifyBaseLogger): PaymentService {
  const hasToken = Boolean(env.MONOPAY_TOKEN);

  return {
    enabled: hasToken,

    async createInvoice(order, config) {
      // Dev-режим без токена: возвращаем заглушку, чтобы можно было протестировать поток.
      if (!hasToken) {
        log.warn('[monopay] no MONOPAY_TOKEN — returning dev invoice stub');
        const base = env.API_BASE_URL ?? `http://localhost:${env.API_PORT}`;
        return {
          invoiceId: `dev-${order.id}`,
          pageUrl: `${base}/api/payments/dev/checkout/${order.id}`,
        };
      }

      const webHookUrl = env.MONOPAY_WEBHOOK_URL ?? (env.API_BASE_URL ? `${env.API_BASE_URL}/api/payments/monopay/webhook` : undefined);
      const redirectUrl = env.API_BASE_URL;

      const res = await fetch(`${MONOPAY_API}/invoice/create`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Token': env.MONOPAY_TOKEN as string,
        },
        body: JSON.stringify({
          amount: order.totalUahCents,
          ccy: CCY_UAH,
          merchantPaymInfo: {
            reference: order.id,
            destination: `Замовлення у ${config.venue.name}`,
          },
          ...(redirectUrl ? { redirectUrl } : {}),
          ...(webHookUrl ? { webHookUrl } : {}),
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        log.error({ status: res.status, body: errBody }, '[monopay] invoice create failed');
        throw new AppError(502, 'payment_provider_error', 'Не вдалося створити рахунок на оплату');
      }

      const data = (await res.json()) as { invoiceId?: string; pageUrl?: string };
      if (!data.invoiceId || !data.pageUrl) {
        throw new AppError(502, 'payment_provider_error', 'Невірна відповідь платіжного провайдера');
      }
      return { invoiceId: data.invoiceId, pageUrl: data.pageUrl };
    },

    parseWebhook(body) {
      const b = (body ?? {}) as MonoWebhookBody;
      if (!b.invoiceId) {
        throw AppError.badRequest('Webhook без invoiceId');
      }
      return {
        invoiceId: b.invoiceId,
        status: mapMonoStatus(b.status),
        ...(b.reference ? { reference: b.reference } : {}),
      };
    },
  };
}
