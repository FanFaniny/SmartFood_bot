import type { TenantConfig } from '@smartfood/config';
import type { DatabaseClient } from '@smartfood/db';
import type { Customer, StaffRole } from '@smartfood/shared';
import type { TelegramWebAppUser } from '@smartfood/telegram';

import type { AppEnv } from './config/env.js';
import type { AppServices } from './services/index.js';
import type { CustomerEventHub } from './services/customerEventHub.js';

export interface StaffContext {
  telegramId: string;
  role: StaffRole;
  id: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    env: AppEnv;
    db: DatabaseClient;
    tenantConfig: TenantConfig;
    tenantId: string;
    services: AppServices;
    eventHub: CustomerEventHub;
  }

  interface FastifyRequest {
    telegramUser: TelegramWebAppUser;
    customer: Customer;
    staff: StaffContext;
  }
}
