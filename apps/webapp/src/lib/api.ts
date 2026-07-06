import type { FeatureFlags, LoyaltyConfig, ThemeConfig, VenueConfig } from '@smartfood/config';
import type {
  CreateOrderRequest,
  LoyaltySummary,
  LoyaltyTransaction,
  MenuCategory,
  Order,
  OrderItem,
  OrderPreviewRequest,
  OrderPreviewResult,
  OrderWithItems,
  Product,
} from '@smartfood/shared';

import { getInitDataRaw } from './telegram';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export interface PaymentInfo {
  invoiceId: string;
  pageUrl: string;
}

export interface BootstrapResponse {
  tenant: {
    tenantId: string;
    venue: VenueConfig;
    theme: ThemeConfig;
    features: FeatureFlags;
    loyalty: LoyaltyConfig;
  };
  customer: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
  loyalty: LoyaltySummary | null;
}

/** Стабильный dev Telegram ID для тестирования вне Telegram. */
function devTelegramId(): string {
  const key = 'smartfood_dev_tg_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = String(100000 + Math.floor(Math.random() * 900000));
    localStorage.setItem(key, id);
  }
  return id;
}

function authHeaders(): Record<string, string> {
  const initData = getInitDataRaw();
  if (initData) return { Authorization: `tma ${initData}` };
  return { 'X-Debug-Telegram-Id': devTelegramId() };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });

  const data = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } } | null)?.error?.message ?? `Помилка ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  bootstrap: () => request<BootstrapResponse>('/api/app/bootstrap'),

  menu: () => request<{ categories: MenuCategory[] }>('/api/menu').then((r) => r.categories),

  product: (id: string) => request<{ product: Product }>(`/api/menu/products/${id}`).then((r) => r.product),

  previewOrder: (body: OrderPreviewRequest) =>
    request<OrderPreviewResult>('/api/orders/preview', { method: 'POST', body: JSON.stringify(body) }),

  createOrder: (body: CreateOrderRequest) =>
    request<{ order: Order; items: OrderItem[]; payment?: PaymentInfo }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listOrders: () => request<{ orders: Order[] }>('/api/orders').then((r) => r.orders),

  getOrder: (id: string) => request<{ order: OrderWithItems }>(`/api/orders/${id}`).then((r) => r.order),

  cancelOrder: (id: string) =>
    request<{ order: Order }>(`/api/orders/${id}/cancel`, { method: 'POST', body: '{}' }).then((r) => r.order),

  loyalty: () =>
    request<{ summary: LoyaltySummary; transactions: LoyaltyTransaction[] }>('/api/loyalty'),

  createInvoice: (orderId: string) =>
    request<{ payment: PaymentInfo }>('/api/payments/monopay/invoice', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    }).then((r) => r.payment),
};
