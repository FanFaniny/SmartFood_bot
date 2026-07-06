import { OrderStatus } from '@smartfood/shared';

export interface StatusMeta {
  label: string;
  className: string;
}

const META: Record<string, StatusMeta> = {
  [OrderStatus.DRAFT]: { label: 'Чернетка', className: 'bg-gray-100 text-gray-600' },
  [OrderStatus.PENDING_PAYMENT]: { label: 'Очікує оплати', className: 'bg-amber-100 text-amber-700' },
  [OrderStatus.PAID]: { label: 'Оплачено', className: 'bg-emerald-100 text-emerald-700' },
  [OrderStatus.ACCEPTED]: { label: 'Прийнято', className: 'bg-blue-100 text-blue-700' },
  [OrderStatus.PREPARING]: { label: 'Готується', className: 'bg-blue-100 text-blue-700' },
  [OrderStatus.READY]: { label: 'Готово 🎉', className: 'bg-emerald-100 text-emerald-700' },
  [OrderStatus.COMPLETED]: { label: 'Завершено', className: 'bg-gray-100 text-gray-600' },
  [OrderStatus.CANCELLED]: { label: 'Скасовано', className: 'bg-rose-100 text-rose-700' },
  [OrderStatus.PAYMENT_FAILED]: { label: 'Помилка оплати', className: 'bg-rose-100 text-rose-700' },
};

export function statusMeta(status: string): StatusMeta {
  return META[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

/** Статусы, при которых клиент ещё может отменить заказ. */
export function isCancellable(status: string): boolean {
  return status === OrderStatus.PENDING_PAYMENT || status === OrderStatus.PAID;
}
