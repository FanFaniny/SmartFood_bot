/**
 * Seed демо-меню для одного тенанта. Идемпотентен: повторный запуск
 * обновляет существующие записи (onConflictDoUpdate по id).
 *
 * config_json для тенанта читается из packages/config/tenants/<id>.client.json,
 * если файл доступен; иначе сохраняется "{}".
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDbClient, type CreateDbOptions } from './client.js';
import { categories, products, tenants } from './schema.js';

export interface SeedOptions extends CreateDbOptions {
  tenantId: string;
}

interface DemoProduct {
  key: string;
  name: string;
  description: string;
  composition: string;
  priceUah: number;
  measureValue: number;
  measureUnit: 'g' | 'ml';
  avgPrepTimeMinutes: number;
}

interface DemoCategory {
  key: string;
  name: string;
  products: DemoProduct[];
}

const DEMO_MENU: DemoCategory[] = [
  {
    key: 'coffee',
    name: 'Кава',
    products: [
      {
        key: 'espresso',
        name: 'Еспресо',
        description: 'Класичний еспресо з арабіки',
        composition: 'Кава арабіка, вода',
        priceUah: 45,
        measureValue: 40,
        measureUnit: 'ml',
        avgPrepTimeMinutes: 3,
      },
      {
        key: 'cappuccino',
        name: 'Капучино',
        description: 'Еспресо з молочною пінкою',
        composition: 'Кава арабіка, молоко',
        priceUah: 65,
        measureValue: 200,
        measureUnit: 'ml',
        avgPrepTimeMinutes: 4,
      },
      {
        key: 'latte',
        name: 'Лате',
        description: 'Ніжна кава з молоком',
        composition: 'Кава арабіка, молоко',
        priceUah: 75,
        measureValue: 300,
        measureUnit: 'ml',
        avgPrepTimeMinutes: 4,
      },
    ],
  },
  {
    key: 'breakfast',
    name: 'Сніданки',
    products: [
      {
        key: 'syrniki',
        name: 'Сирники зі сметаною',
        description: 'Домашні сирники з ягідним джемом',
        composition: 'Сир, яйце, борошно, сметана, джем',
        priceUah: 145,
        measureValue: 250,
        measureUnit: 'g',
        avgPrepTimeMinutes: 12,
      },
      {
        key: 'omelette',
        name: 'Омлет з овочами',
        description: 'Пухкий омлет із сезонними овочами',
        composition: 'Яйця, томати, перець, зелень',
        priceUah: 135,
        measureValue: 220,
        measureUnit: 'g',
        avgPrepTimeMinutes: 10,
      },
      {
        key: 'oatmeal',
        name: 'Вівсянка з фруктами',
        description: 'Вівсяна каша на молоці зі свіжими фруктами',
        composition: 'Вівсянка, молоко, банан, ягоди',
        priceUah: 110,
        measureValue: 300,
        measureUnit: 'g',
        avgPrepTimeMinutes: 8,
      },
    ],
  },
  {
    key: 'desserts',
    name: 'Десерти',
    products: [
      {
        key: 'cheesecake',
        name: 'Чізкейк Нью-Йорк',
        description: 'Класичний вершковий чізкейк',
        composition: 'Вершковий сир, печиво, вершки',
        priceUah: 120,
        measureValue: 150,
        measureUnit: 'g',
        avgPrepTimeMinutes: 2,
      },
      {
        key: 'tiramisu',
        name: 'Тірамісу',
        description: 'Італійський десерт з маскарпоне',
        composition: 'Маскарпоне, савоярді, кава, какао',
        priceUah: 130,
        measureValue: 160,
        measureUnit: 'g',
        avgPrepTimeMinutes: 2,
      },
    ],
  },
  {
    key: 'drinks',
    name: 'Напої',
    products: [
      {
        key: 'orange-juice',
        name: 'Свіжий апельсиновий фреш',
        description: 'Сік зі свіжих апельсинів',
        composition: 'Апельсин',
        priceUah: 95,
        measureValue: 300,
        measureUnit: 'ml',
        avgPrepTimeMinutes: 3,
      },
      {
        key: 'lemonade',
        name: 'Домашній лимонад',
        description: 'Освіжний лимонад з м’ятою',
        composition: 'Лимон, м’ята, вода, сироп',
        priceUah: 85,
        measureValue: 400,
        measureUnit: 'ml',
        avgPrepTimeMinutes: 3,
      },
    ],
  },
];

function readTenantConfigJson(tenantId: string): string {
  try {
    // dist/seed.js -> ../../config/tenants/
    const tenantsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'config', 'tenants');
    const specific = join(tenantsDir, `${tenantId}.client.json`);
    const configPath = existsSync(specific) ? specific : join(tenantsDir, 'default.client.json');
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return '{}';
  }
}

export async function seed(databaseUrl: string, options: SeedOptions): Promise<void> {
  const { tenantId, ...dbOptions } = options;
  const db = createDbClient(databaseUrl, dbOptions);

  await db
    .insert(tenants)
    .values({
      id: tenantId,
      name: tenantId,
      configJson: readTenantConfigJson(tenantId),
    })
    .onConflictDoUpdate({
      target: tenants.id,
      set: { configJson: readTenantConfigJson(tenantId) },
    });

  let categorySort = 0;
  for (const category of DEMO_MENU) {
    const categoryId = `${tenantId}-cat-${category.key}`;
    categorySort += 1;
    await db
      .insert(categories)
      .values({
        id: categoryId,
        tenantId,
        name: category.name,
        sortOrder: categorySort,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: categories.id,
        set: { name: category.name, sortOrder: categorySort, isActive: true },
      });

    let productSort = 0;
    for (const product of category.products) {
      const productId = `${tenantId}-prod-${product.key}`;
      productSort += 1;
      const values = {
        id: productId,
        tenantId,
        categoryId,
        name: product.name,
        description: product.description,
        composition: product.composition,
        priceUahCents: product.priceUah * 100,
        measureValue: product.measureValue,
        measureUnit: product.measureUnit,
        avgPrepTimeMinutes: product.avgPrepTimeMinutes,
        isActive: true,
        sortOrder: productSort,
      };
      await db
        .insert(products)
        .values(values)
        .onConflictDoUpdate({ target: products.id, set: values });
    }
  }

  const totalProducts = DEMO_MENU.reduce((sum, c) => sum + c.products.length, 0);
  console.log(
    `[db] seed: tenant "${tenantId}" — ${DEMO_MENU.length} categories, ${totalProducts} products`,
  );

  db.$client.close();
}
