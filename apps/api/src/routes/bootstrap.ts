import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

export function registerBootstrapRoutes(app: FastifyInstance, preHandler: preHandlerHookHandler[]): void {
  app.get('/api/app/bootstrap', { preHandler }, async (request) => {
    const config = app.tenantConfig;
    const loyalty = config.features.loyalty
      ? await app.services.loyalty.getSummary(app.tenantId, request.customer.id, config)
      : null;

    return {
      tenant: {
        tenantId: config.tenantId,
        venue: config.venue,
        theme: config.theme,
        features: config.features,
        loyalty: config.loyalty,
      },
      customer: {
        id: request.customer.id,
        telegramId: request.customer.telegramId,
        firstName: request.customer.firstName,
        lastName: request.customer.lastName,
        username: request.customer.username,
      },
      loyalty,
    };
  });
}
