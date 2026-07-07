import type { CustomerSseEvent } from '@smartfood/shared';

export type SseSend = (chunk: string) => void;

export interface CustomerEventHub {
  subscribe(customerId: string, send: SseSend): () => void;
  publish(customerId: string, event: CustomerSseEvent): void;
}

function formatSseData(event: CustomerSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function createCustomerEventHub(): CustomerEventHub {
  const channels = new Map<string, Set<SseSend>>();

  return {
    subscribe(customerId, send) {
      let listeners = channels.get(customerId);
      if (!listeners) {
        listeners = new Set();
        channels.set(customerId, listeners);
      }
      listeners.add(send);

      return () => {
        listeners!.delete(send);
        if (listeners!.size === 0) channels.delete(customerId);
      };
    },

    publish(customerId, event) {
      const listeners = channels.get(customerId);
      if (!listeners || listeners.size === 0) return;

      const chunk = formatSseData(event);
      for (const send of listeners) {
        try {
          send(chunk);
        } catch {
          listeners.delete(send);
        }
      }
    },
  };
}
