import { CreateOrderRequestSchema, OrderPreviewRequestSchema } from '@smartfood/shared';
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

export function registerOrderRoutes(app: FastifyInstance, preHandler: preHandlerHookHandler[]): void {
  const { order } = app.services;

  app.post('/api/orders/preview', { preHandler }, async (request) => {
    const body = OrderPreviewRequestSchema.parse(request.body);
    const result = await order.preview(app.tenantId, request.customer.id, body, app.tenantConfig);
    return result;
  });

  app.post('/api/orders', { preHandler }, async (request, reply) => {
    const body = CreateOrderRequestSchema.parse(request.body);
    const created = await order.create(app.tenantId, request.customer.id, body, app.tenantConfig);
    reply.status(201);
    return {
      order: created.order,
      items: created.items,
      ...(created.payment ? { payment: created.payment } : {}),
    };
  });

  app.get('/api/orders', { preHandler }, async (request) => {
    const list = await order.listByCustomer(app.tenantId, request.customer.id);
    return { orders: list };
  });

  app.get<{ Params: { id: string } }>('/api/orders/:id', { preHandler }, async (request) => {
    const found = await order.getById(app.tenantId, request.customer.id, request.params.id);
    return { order: found };
  });

  app.post<{ Params: { id: string } }>('/api/orders/:id/cancel', { preHandler }, async (request) => {
    const cancelled = await order.cancelByCustomer(
      app.tenantId,
      request.customer.id,
      request.params.id,
      app.tenantConfig,
    );
    return { order: cancelled };
  });
}
