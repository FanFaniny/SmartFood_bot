import type { DatabaseClient } from '@smartfood/db';

/** Тип транзакции drizzle, выведенный из DatabaseClient.transaction. */
export type Tx = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];

/** Исполнитель запросов: либо корневой клиент, либо транзакция. */
export type Executor = DatabaseClient | Tx;
