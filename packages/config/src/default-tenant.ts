/**
 * Browser-safe entry: экспорт defaultTenantConfig для импорта в webapp без Node.js load.ts.
 */

import defaultClient from '../tenants/default.client.json' with { type: 'json' };

import { TenantConfigSchema, type TenantConfig } from './tenant.js';

export const defaultTenantConfig: TenantConfig = TenantConfigSchema.parse(defaultClient);
