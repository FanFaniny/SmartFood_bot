import type { CreateOrderRequest, Order, OrderPreviewRequest, OrderWithItems } from '@smartfood/shared';
import { OrderStatus } from '@smartfood/shared';
import type { Query } from '@tanstack/react-query';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../lib/api';

const PENDING_PAYMENT_POLL_MS = 3_000;
const LIVE_ORDER_POLL_MS = 15_000;

const orderQueryOptions = {
  staleTime: 0,
  refetchOnWindowFocus: true,
} as const;

function hasPendingPayment(orders: Order[] | undefined): boolean {
  return orders?.some((o) => o.status === OrderStatus.PENDING_PAYMENT) ?? false;
}

function ordersPollInterval(query: Query<Order[], Error>): number | false {
  return hasPendingPayment(query.state.data) ? PENDING_PAYMENT_POLL_MS : false;
}

function orderPollInterval(query: Query<OrderWithItems, Error>): number | false {
  const status = query.state.data?.status;
  if (!status) return false;
  if (status === OrderStatus.PENDING_PAYMENT) return PENDING_PAYMENT_POLL_MS;
  if (
    status === OrderStatus.PAID ||
    status === OrderStatus.ACCEPTED ||
    status === OrderStatus.PREPARING
  ) {
    return LIVE_ORDER_POLL_MS;
  }
  return false;
}

export function useBootstrap() {
  return useQuery({ queryKey: ['bootstrap'], queryFn: api.bootstrap });
}

export function useMenu() {
  return useQuery({ queryKey: ['menu'], queryFn: api.menu });
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: api.listOrders,
    ...orderQueryOptions,
    refetchInterval: ordersPollInterval,
    refetchIntervalInBackground: true,
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => api.getOrder(id as string),
    enabled: Boolean(id),
    ...orderQueryOptions,
    refetchInterval: orderPollInterval,
    refetchIntervalInBackground: true,
  });
}

export function useLoyalty() {
  return useQuery({ queryKey: ['loyalty'], queryFn: api.loyalty });
}

export function useOrderPreview(body: OrderPreviewRequest, enabled: boolean) {
  return useQuery({
    queryKey: ['preview', body],
    queryFn: () => api.previewOrder(body),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrderRequest) => api.createOrder(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order'] });
      void qc.invalidateQueries({ queryKey: ['loyalty'] });
      void qc.invalidateQueries({ queryKey: ['bootstrap'] });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelOrder(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order'] });
      void qc.invalidateQueries({ queryKey: ['loyalty'] });
      void qc.invalidateQueries({ queryKey: ['bootstrap'] });
    },
  });
}
