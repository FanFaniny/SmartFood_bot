import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TenantConfigSchema, type TenantConfig } from './tenant.js';

const tenantsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tenants');

/**
 * Путь к JSON-конфигу тенанта: сначала `<tenantId>.client.json`,
 * иначе fallback на `default.client.json` (демо-конфиг шаблона).
 */
export function resolveTenantConfigPath(tenantId: string): string {
  const specific = join(tenantsDir, `${tenantId}.client.json`);
  return existsSync(specific) ? specific : join(tenantsDir, 'default.client.json');
}

export function loadTenantConfig(tenantId: string): TenantConfig {
  const raw = readFileSync(resolveTenantConfigPath(tenantId), 'utf-8');
  return TenantConfigSchema.parse(JSON.parse(raw));
}

export function loadDefaultTenantConfig(defaultTenantId = 'demo-cafe'): TenantConfig {
  return loadTenantConfig(defaultTenantId);
}
