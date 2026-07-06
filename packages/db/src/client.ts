/**
 * SQLite-клиент на базе Drizzle ORM + @libsql/client.
 *
 * databaseUrl поддерживает:
 * - локальный файл: "./data/smartfood.db" или "file:./data/smartfood.db";
 * - удалённый libsql/Turso: "libsql://..." (через authToken).
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';

import { schema } from './schema.js';

export type DatabaseClient = LibSQLDatabase<typeof schema> & {
  $client: Client;
};

function normalizeUrl(databaseUrl: string): string {
  if (databaseUrl.includes('://')) return databaseUrl;
  return `file:${databaseUrl}`;
}

export interface CreateDbOptions {
  authToken?: string;
}

export function createDbClient(databaseUrl: string, options: CreateDbOptions = {}): DatabaseClient {
  const client = createClient({
    url: normalizeUrl(databaseUrl),
    ...(options.authToken ? { authToken: options.authToken } : {}),
  });
  return drizzle(client, { schema }) as DatabaseClient;
}
