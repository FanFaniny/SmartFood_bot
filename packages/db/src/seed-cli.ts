#!/usr/bin/env node
/** CLI-обёртка для `pnpm db:seed --tenant=<id>`. */
import { seed } from './seed.js';

const databaseUrl = process.env['DATABASE_URL'] ?? './data/smartfood.db';
const tenantId =
  process.argv.find((arg: string) => arg.startsWith('--tenant='))?.split('=')[1] ??
  process.env['DEFAULT_TENANT_ID'] ??
  'demo-cafe';
const authToken = process.env['DATABASE_AUTH_TOKEN'];

await seed(databaseUrl, { tenantId, ...(authToken ? { authToken } : {}) });
