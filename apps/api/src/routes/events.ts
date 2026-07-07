import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

const HEARTBEAT_MS = 30_000;

export function registerEventRoutes(app: FastifyInstance, preHandler: preHandlerHookHandler[]): void {
  app.get('/api/events/stream', { preHandler }, async (request, reply) => {
    const customerId = request.customer.id;

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (chunk: string): void => {
      if (!reply.raw.writableEnded) reply.raw.write(chunk);
    };

    send(': connected\n\n');

    const unsubscribe = app.eventHub.subscribe(customerId, send);

    const heartbeat = setInterval(() => {
      send(': ping\n\n');
    }, HEARTBEAT_MS);

    const cleanup = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
      if (!reply.raw.writableEnded) reply.raw.end();
    };

    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);
  });
}
