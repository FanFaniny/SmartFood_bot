/**
 * Применение Drizzle-миграций к SQLite. SQL-файлы лежат в packages/db/drizzle
 * и генерируются командой `drizzle-kit generate` из schema.ts.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate as drizzleMigrate } from 'drizzle-orm/libsql/migrator';

import { createDbClient, type CreateDbOptions } from './client.js';

// dist/migrate.js -> ../drizzle (packages/db/drizzle)
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

export async function migrate(databaseUrl: string, options: CreateDbOptions = {}): Promise<void> {
  const db = createDbClient(databaseUrl, options);
  await drizzleMigrate(db, { migrationsFolder });
  db.$client.close();
}
