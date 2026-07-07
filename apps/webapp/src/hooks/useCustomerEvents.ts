import type { CustomerSseEvent, Order, OrderWithItems } from '@smartfood/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { connectCustomerEvents } from '../lib/sse';

function patchOrdersList(prev: Order[] | undefined, order: Order): Order[] | undefined {
  if (!prev) return prev;

  const idx = prev.findIndex((o) => o.id === order.id);
  if (idx === -1) return [order, ...prev];

  const next = [...prev];
  next[idx] = order;
  return next;
}

function patchOrderDetail(prev: OrderWithItems | undefined, order: Order): OrderWithItems | undefined {
  if (!prev) return prev;
  return { ...prev, ...order };
}

export function useCustomerEvents(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const handleEvent = (event: CustomerSseEvent): void => {
      if (event.type === 'order.updated') {
        const { order } = event;
        qc.setQueryData<Order[]>(['orders'], (prev) => patchOrdersList(prev, order));
        qc.setQueryData<OrderWithItems>(['order', order.id], (prev) => patchOrderDetail(prev, order));
        return;
      }

      void qc.invalidateQueries({ queryKey: ['loyalty'] });
      void qc.invalidateQueries({ queryKey: ['bootstrap'] });
    };

    const handleDisconnect = (): void => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order'] });
      void qc.invalidateQueries({ queryKey: ['loyalty'] });
      void qc.invalidateQueries({ queryKey: ['bootstrap'] });
    };

    const connection = connectCustomerEvents({
      onEvent: handleEvent,
      onDisconnect: handleDisconnect,
    });

    return () => connection.close();
  }, [qc]);
}
