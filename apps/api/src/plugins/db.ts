import { createDbClient, type DatabaseClient } from '@smartfood/db';
import type { FastifyInstance } from 'fastify';

import type { AppEnv } from '../config/env.js';

export function createDb(env: AppEnv): DatabaseClient {
  return createDbClient(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN ? { authToken: env.DATABASE_AUTH_TOKEN } : {});
}

export function registerDb(app: FastifyInstance, db: DatabaseClient): void {
  app.decorate('db', db);
  app.addHook('onClose', async () => {
    db.$client.close();
  });
}
