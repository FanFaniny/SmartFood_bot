import { categories, products } from '@smartfood/db';
import type { MenuCategory, Product } from '@smartfood/shared';
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { and, asc, eq } from 'drizzle-orm';

import { AppError } from '../plugins/errors.js';

function mapProduct(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    tenantId: row.tenantId,
    categoryId: row.categoryId,
    name: row.name,
    description: row.description,
    composition: row.composition,
    imageUrl: row.imageUrl,
    priceUahCents: row.priceUahCents,
    measureValue: row.measureValue,
    measureUnit: row.measureUnit,
    avgPrepTimeMinutes: row.avgPrepTimeMinutes,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export function registerMenuRoutes(app: FastifyInstance, preHandler: preHandlerHookHandler[]): void {
  app.get('/api/menu', { preHandler }, async () => {
    const tenantId = app.tenantId;

    const categoryRows = await app.db
      .select()
      .from(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.isActive, true)))
      .orderBy(asc(categories.sortOrder));

    const productRows = await app.db
      .select()
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)))
      .orderBy(asc(products.sortOrder));

    const productsByCategory = new Map<string, Product[]>();
    for (const row of productRows) {
      const list = productsByCategory.get(row.categoryId) ?? [];
      list.push(mapProduct(row));
      productsByCategory.set(row.categoryId, list);
    }

    const menu: MenuCategory[] = categoryRows.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      products: productsByCategory.get(c.id) ?? [],
    }));

    return { categories: menu };
  });

  app.get<{ Params: { id: string } }>('/api/menu/products/:id', { preHandler }, async (request) => {
    const rows = await app.db
      .select()
      .from(products)
      .where(and(eq(products.tenantId, app.tenantId), eq(products.id, request.params.id)))
      .limit(1);
    const row = rows[0];
    if (!row || !row.isActive) throw AppError.notFound('Товар не знайдено');
    return { product: mapProduct(row) };
  });
}
