import type { OrderPreviewRequest } from '@smartfood/shared';
import { useMemo, useRef, useState } from 'react';

import { LoyaltyPointsSlider } from '../components/LoyaltyPointsSlider';
import { CenterState, PrimaryButton, Spinner } from '../components/ui';
import { useBootstrap, useCreateOrder, useOrderPreview } from '../hooks/queries';
import { formatUah } from '../lib/format';
import { haptic, openExternal } from '../lib/telegram';
import { cartSubtotalCents, toCartItemsInput, useCart } from '../store/cart';

export function CartScreen({
  onBackToMenu,
  onOrderCreated,
}: {
  onBackToMenu: () => void;
  onOrderCreated: (orderId: string) => void;
}) {
  const lines = useCart((s) => s.lines);
  const setQuantity = useCart((s) => s.setQuantity);
  const clear = useCart((s) => s.clear);
  const bootstrap = useBootstrap();
  const createOrder = useCreateOrder();

  const [pointsForPreview, setPointsForPreview] = useState(0);
  const pointsForCheckoutRef = useRef(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loyaltyEnabled = bootstrap.data?.tenant.features.loyalty ?? false;
  const balance = bootstrap.data?.loyalty?.pointsBalance ?? 0;

  const previewBody = useMemo<OrderPreviewRequest>(
    () => ({ items: toCartItemsInput(lines), pointsToSpend: pointsForPreview }),
    [lines, pointsForPreview],
  );
  const preview = useOrderPreview(previewBody, lines.length > 0);

  const localSubtotal = cartSubtotalCents(lines);
  const maxSpendable = preview.data?.maxLoyaltyPointsSpendable ?? 0;

  if (lines.length === 0) {
    return (
      <div className="flex flex-col">
        <ScreenHeader title="Кошик" />
        <CenterState icon="🛒" title="Кошик порожній" subtitle="Додайте щось смачне з меню" />
        <div className="px-4">
          <PrimaryButton onClick={onBackToMenu}>Перейти до меню</PrimaryButton>
        </div>
      </div>
    );
  }

  const handleCheckout = async () => {
    setError(null);
    try {
      const result = await createOrder.mutateAsync({
        items: toCartItemsInput(lines),
        pointsToSpend: pointsForCheckoutRef.current,
        ...(note.trim() ? { customerNote: note.trim() } : {}),
      });
      haptic('success');
      clear();
      if (result.payment?.pageUrl) {
        openExternal(result.payment.pageUrl);
      }
      onOrderCreated(result.order.id);
    } catch (e) {
      haptic('error');
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col pb-4">
      <ScreenHeader title="Кошик" />

      <div className="flex flex-col gap-2.5 px-4">
        {lines.map((line) => (
          <div key={line.product.id} className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface)] p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{line.product.name}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{formatUah(line.product.priceUahCents)}</p>
              {(line.allergensNote || line.preferencesNote) && (
                <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                  {[line.allergensNote, line.preferencesNote].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                className="h-8 w-8 rounded-full bg-[var(--color-bg)] text-lg"
              >
                −
              </button>
              <span className="w-5 text-center text-sm font-semibold">{line.quantity}</span>
              <button
                onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                className="h-8 w-8 rounded-full bg-[var(--color-bg)] text-lg"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pt-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Коментар до замовлення (необов'язково)"
          rows={2}
          className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      {loyaltyEnabled && balance > 0 && maxSpendable > 0 && (
        <LoyaltyPointsSlider
          max={maxSpendable}
          balance={balance}
          onPreviewPointsChange={setPointsForPreview}
          onLivePointsChange={(points) => {
            pointsForCheckoutRef.current = points;
          }}
        />
      )}

      <div className="mx-4 mt-4 flex flex-col gap-1.5 rounded-2xl bg-[var(--color-surface)] p-4 text-sm">
        <Row label="Сума" value={formatUah(preview.data?.subtotalUahCents ?? localSubtotal)} />
        {(preview.data?.loyaltyDiscountUahCents ?? 0) > 0 && (
          <Row label="Знижка балами" value={`−${formatUah(preview.data!.loyaltyDiscountUahCents)}`} accent />
        )}
        <div className="my-1 h-px bg-gray-200" />
        <Row label="До сплати" value={formatUah(preview.data?.totalUahCents ?? localSubtotal)} bold />
        {(preview.data?.loyaltyPointsEarned ?? 0) > 0 && (
          <p className="pt-1 text-xs text-[var(--color-primary)]">
            + {preview.data!.loyaltyPointsEarned} балів за це замовлення
          </p>
        )}
      </div>

      {error && <p className="px-4 pt-3 text-center text-sm text-rose-600">{error}</p>}

      <div className="px-4 pt-4">
        {preview.isLoading && !preview.data ? (
          <Spinner />
        ) : (
          <PrimaryButton onClick={handleCheckout} disabled={createOrder.isPending}>
            {createOrder.isPending
              ? 'Оформлюємо…'
              : `Оформити · ${formatUah(preview.data?.totalUahCents ?? localSubtotal)}`}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

function ScreenHeader({ title }: { title: string }) {
  return <h1 className="px-4 pt-5 pb-3 text-2xl font-bold">{title}</h1>;
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={accent ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}>{label}</span>
      <span className={`${bold ? 'text-base font-semibold' : ''} ${accent ? 'text-[var(--color-primary)]' : ''}`}>
        {value}
      </span>
    </div>
  );
}
