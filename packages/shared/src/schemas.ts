/**
 * Zod-схемы запросов/ответов клиентского API.
 *
 * Эти схемы — единый источник правды для валидации на бэкенде (Fastify, этап 3)
 * и типобезопасных запросов на фронтенде (webapp, этап 5). Типы выводятся через z.infer.
 */

import { z } from 'zod';

import { ServiceType } from './enums.js';

const serviceTypeSchema = z.nativeEnum(ServiceType);

const noteSchema = z.string().trim().max(500).optional();

/** Позиция корзины, приходящая с клиента (цены тут НЕ доверяем — пересчёт на сервере). */
export const CartItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  serviceType: serviceTypeSchema.optional(),
  allergensNote: noteSchema,
  preferencesNote: noteSchema,
});
export type CartItemInput = z.infer<typeof CartItemInputSchema>;

/** POST /api/orders/preview — расчёт корзины, скидки баллами и будущих баллов. */
export const OrderPreviewRequestSchema = z.object({
  items: z.array(CartItemInputSchema).min(1).max(100),
  pointsToSpend: z.number().int().min(0).optional(),
});
export type OrderPreviewRequest = z.infer<typeof OrderPreviewRequestSchema>;

/** POST /api/orders — создание заказа. */
export const CreateOrderRequestSchema = OrderPreviewRequestSchema.extend({
  customerNote: noteSchema,
});
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

/** Разбивка одной позиции в ответе preview. */
export const OrderPreviewLineSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  unitPriceUahCents: z.number().int(),
  totalPriceUahCents: z.number().int(),
});
export type OrderPreviewLine = z.infer<typeof OrderPreviewLineSchema>;

/** Ответ POST /api/orders/preview — всё пересчитано на сервере. */
export const OrderPreviewResultSchema = z.object({
  lines: z.array(OrderPreviewLineSchema),
  subtotalUahCents: z.number().int(),
  loyaltyPointsSpent: z.number().int(),
  loyaltyDiscountUahCents: z.number().int(),
  totalUahCents: z.number().int(),
  loyaltyPointsEarned: z.number().int(),
  maxLoyaltyPointsSpendable: z.number().int(),
});
export type OrderPreviewResult = z.infer<typeof OrderPreviewResultSchema>;
