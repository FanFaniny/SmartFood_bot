import type { CreateOrderRequest, OrderPreviewRequest } from '@smartfood/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../lib/api';

const orderQueryOptions = {
  staleTime: 0,
  refetchOnWindowFocus: true,
} as const;

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
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => api.getOrder(id as string),
    enabled: Boolean(id),
    ...orderQueryOptions,
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
