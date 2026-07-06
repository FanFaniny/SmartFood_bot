import type { DatabaseClient } from '@smartfood/db';
import type { FastifyBaseLogger } from 'fastify';

import type { AppEnv } from '../config/env.js';
import { createLoyaltyService, type LoyaltyService } from './loyaltyService.js';
import { createOrderService, type OrderService } from './orderService.js';
import { createPaymentService, type PaymentService } from './paymentService.js';
import { createTelegramNotifyService, type TelegramNotifyService } from './telegramNotifyService.js';

export interface AppServices {
  loyalty: LoyaltyService;
  payment: PaymentService;
  notify: TelegramNotifyService;
  order: OrderService;
}

export function buildServices(env: AppEnv, db: DatabaseClient, log: FastifyBaseLogger): AppServices {
  const loyalty = createLoyaltyService(db);
  const payment = createPaymentService(env, log);
  const notify = createTelegramNotifyService(env, log);
  const order = createOrderService({ db, loyalty, payment, notify, log });
  return { loyalty, payment, notify, order };
}

export type { LoyaltyService, OrderService, PaymentService, TelegramNotifyService };
