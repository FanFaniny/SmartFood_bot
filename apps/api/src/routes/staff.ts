import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

import { ActorType } from '@smartfood/shared';

export function registerStaffRoutes(app: FastifyInstance, preHandler: preHandlerHookHandler[]): void {
  const { order } = app.services;

  app.get('/api/staff/orders/active', { preHandler }, async () => {
    const orders = await order.listActiveForStaff(app.tenantId);
    return { orders };
  });

  for (const action of ['accept', 'ready', 'cancel'] as const) {
    app.post<{ Params: { id: string } }>(
      `/api/staff/orders/:id/${action}`,
      { preHandler },
      async (request) => {
        const updated = await order.staffTransition(
          app.tenantId,
          request.params.id,
          action,
          { actorType: ActorType.STAFF, actorId: request.staff.id },
          app.tenantConfig,
        );
        return { order: updated };
      },
    );
  }
}
