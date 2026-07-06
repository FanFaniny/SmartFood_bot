import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

import { AppError } from '../plugins/errors.js';

export function registerLoyaltyRoutes(app: FastifyInstance, preHandler: preHandlerHookHandler[]): void {
  app.get('/api/loyalty', { preHandler }, async (request) => {
    if (!app.tenantConfig.features.loyalty) {
      throw AppError.forbidden('Програма лояльності вимкнена');
    }
    const customerId = request.customer.id;
    const [summary, transactions] = await Promise.all([
      app.services.loyalty.getSummary(app.tenantId, customerId, app.tenantConfig),
      app.services.loyalty.listTransactions(app.tenantId, customerId),
    ]);
    return { summary, transactions };
  });
}
