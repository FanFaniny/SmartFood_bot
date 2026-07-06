#!/usr/bin/env node
/** CLI-обёртка для `pnpm db:migrate`. */
import { migrate } from './migrate.js';

const databaseUrl = process.env['DATABASE_URL'] ?? './data/smartfood.db';
const authToken = process.env['DATABASE_AUTH_TOKEN'];

await migrate(databaseUrl, authToken ? { authToken } : {});
console.log('[db] migrate: done');
