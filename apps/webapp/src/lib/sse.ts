import type { CustomerSseEvent } from '@smartfood/shared';

import { getApiAuthHeaders, getApiBaseUrl } from './api';

export interface CustomerEventsConnection {
  close: () => void;
}

const MIN_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

function consumeSseMessages(buffer: string): { events: CustomerSseEvent[]; rest: string } {
  const events: CustomerSseEvent[] = [];
  let rest = buffer;

  let sepIdx = rest.indexOf('\n\n');
  while (sepIdx !== -1) {
    const block = rest.slice(0, sepIdx);
    rest = rest.slice(sepIdx + 2);

    for (const line of block.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        events.push(JSON.parse(line.slice(6)) as CustomerSseEvent);
      } catch {
        /* skip malformed chunk */
      }
    }

    sepIdx = rest.indexOf('\n\n');
  }

  return { events, rest };
}

export function connectCustomerEvents(handlers: {
  onEvent: (event: CustomerSseEvent) => void;
  onDisconnect?: () => void;
}): CustomerEventsConnection {
  let aborted = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  const abortController = new AbortController();

  const scheduleReconnect = (): void => {
    if (aborted) return;
    const delay = Math.min(MIN_RECONNECT_MS * 2 ** reconnectAttempt, MAX_RECONNECT_MS);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => void connect(), delay);
  };

  const connect = async (): Promise<void> => {
    if (aborted) return;

    let buffer = '';
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/events/stream`, {
        headers: getApiAuthHeaders(),
        signal: abortController.signal,
      });

      if (!res.ok || !res.body) {
        handlers.onDisconnect?.();
        scheduleReconnect();
        return;
      }

      reconnectAttempt = 0;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parsed = consumeSseMessages(buffer);
        buffer = parsed.rest;

        for (const event of parsed.events) handlers.onEvent(event);
      }
    } catch (e) {
      if (aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
    }

    if (!aborted) {
      handlers.onDisconnect?.();
      scheduleReconnect();
    }
  };

  void connect();

  return {
    close: () => {
      aborted = true;
      clearTimeout(reconnectTimer);
      abortController.abort();
    },
  };
}
