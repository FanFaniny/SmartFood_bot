import { OrderStatus } from '@smartfood/shared';
import { useState } from 'react';

import { Sheet } from '../components/Sheet';
import { CenterState, ErrorState, PrimaryButton, Spinner, StatusBadge } from '../components/ui';
import { useCancelOrder, useOrder, useOrders } from '../hooks/queries';
import { api } from '../lib/api';
import { formatDateTime, formatUah } from '../lib/format';
import { isCancellable, statusMeta } from '../lib/status';
import { haptic, openExternal } from '../lib/telegram';

export function OrdersScreen({ initialOrderId }: { initialOrderId: string | null }) {
  const orders = useOrders();
  const [selectedId, setSelectedId] = useState<string | null>(initialOrderId);

  return (
    <div className="flex flex-col">
      <h1 className="px-4 pt-5 pb-3 text-2xl font-bold">Замовлення</h1>

      {orders.isLoading && <Spinner />}
      {orders.isError && <ErrorState message={(orders.error as Error).message} onRetry={() => orders.refetch()} />}
      {orders.data && orders.data.length === 0 && (
        <CenterState icon="🧾" title="Ще немає замовлень" subtitle="Ваші замовлення з'являться тут" />
      )}

      {orders.data && orders.data.length > 0 && (
        <div className="flex flex-col gap-2.5 px-4 pb-4">
          {orders.data.map((order) => {
            const meta = statusMeta(order.status);
            return (
              <button
                key={order.id}
                onClick={() => setSelectedId(order.id)}
                className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-surface)] p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="font-medium">#{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatDateTime(order.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge label={meta.label} className={meta.className} />
                  <span className="text-sm font-semibold">{formatUah(order.totalUahCents)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <OrderDetailSheet orderId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function OrderDetailSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const order = useOrder(orderId);
  const cancelOrder = useCancelOrder();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = order.data;

  const handlePay = async () => {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const payment = await api.createInvoice(data.id);
      openExternal(payment.pageUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      await cancelOrder.mutateAsync(data.id);
      haptic('success');
      onClose();
    } catch (e) {
      haptic('error');
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={Boolean(orderId)} onClose={onClose}>
      {!data ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Замовлення #{data.id.slice(0, 8)}</h2>
            <StatusBadge {...statusMeta(data.status)} />
          </div>

          <div className="flex flex-col gap-2">
            {data.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {item.productSnapshot.name} ×{item.quantity}
                </span>
                <span className="ml-2 shrink-0 text-[var(--color-text-muted)]">{formatUah(item.totalPriceUahCents)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1 border-t border-gray-200 pt-3 text-sm">
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>Сума</span>
              <span>{formatUah(data.subtotalUahCents)}</span>
            </div>
            {data.loyaltyDiscountUahCents > 0 && (
              <div className="flex justify-between text-[var(--color-primary)]">
                <span>Знижка балами</span>
                <span>−{formatUah(data.loyaltyDiscountUahCents)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Разом</span>
              <span>{formatUah(data.totalUahCents)}</span>
            </div>
            {data.loyaltyPointsEarned > 0 && (
              <p className="pt-1 text-xs text-[var(--color-primary)]">+{data.loyaltyPointsEarned} балів нараховано</p>
            )}
          </div>

          {error && <p className="text-center text-sm text-rose-600">{error}</p>}

          {data.status === OrderStatus.PENDING_PAYMENT && (
            <PrimaryButton onClick={handlePay} disabled={busy}>
              Сплатити · {formatUah(data.totalUahCents)}
            </PrimaryButton>
          )}
          {isCancellable(data.status) && (
            <button
              onClick={handleCancel}
              disabled={busy}
              className="py-2 text-sm font-medium text-rose-600 disabled:opacity-40"
            >
              Скасувати замовлення
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
