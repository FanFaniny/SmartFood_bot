/**
 * События SSE-потока GET /api/events/stream (push клиенту webapp).
 */

import type { Order } from './types.js';

export type CustomerSseEvent =
  | { type: 'order.updated'; order: Order }
  | { type: 'loyalty.updated' };
