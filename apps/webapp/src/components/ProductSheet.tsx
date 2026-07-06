import type { Product, ServiceType } from '@smartfood/shared';
import { ServiceType as ServiceTypeEnum } from '@smartfood/shared';
import { useEffect, useState } from 'react';

import { formatMeasure, formatPrepTime, formatUah } from '../lib/format';
import { haptic } from '../lib/telegram';
import { useCart } from '../store/cart';
import { Sheet } from './Sheet';
import { PrimaryButton } from './ui';

export function ProductSheet({
  product,
  onClose,
  onGoToCart,
}: {
  product: Product | null;
  onClose: () => void;
  onGoToCart: () => void;
}) {
  const addLine = useCart((s) => s.addLine);
  const [quantity, setQuantity] = useState(1);
  const [serviceType, setServiceType] = useState<ServiceType>(ServiceTypeEnum.TAKEAWAY);
  const [allergens, setAllergens] = useState('');
  const [preferences, setPreferences] = useState('');
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (product) {
      setQuantity(1);
      setServiceType(ServiceTypeEnum.TAKEAWAY);
      setAllergens('');
      setPreferences('');
      setAdded(false);
    }
  }, [product]);

  if (!product) return null;

  const handleAdd = () => {
    addLine({
      product,
      quantity,
      serviceType,
      ...(allergens.trim() ? { allergensNote: allergens.trim() } : {}),
      ...(preferences.trim() ? { preferencesNote: preferences.trim() } : {}),
    });
    haptic('success');
    setAdded(true);
  };

  return (
    <Sheet open={Boolean(product)} onClose={onClose}>
      {added ? (
        <div className="flex flex-col gap-4 py-2">
          <div className="text-center">
            <div className="mb-2 text-4xl">✅</div>
            <p className="text-lg font-semibold">Додано в кошик</p>
            <p className="text-sm text-[var(--color-text-muted)]">{product.name} ×{quantity}</p>
          </div>
          <PrimaryButton onClick={onGoToCart}>Перейти в кошик</PrimaryButton>
          <button onClick={onClose} className="py-2 text-sm font-medium text-[var(--color-text-muted)]">
            Продовжити вибір
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="h-44 w-full overflow-hidden rounded-2xl bg-gray-200">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl">🍽️</div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold">{product.name}</h2>
            <div className="mt-1 flex gap-2 text-sm text-[var(--color-text-muted)]">
              <span>{formatMeasure(product.measureValue, product.measureUnit)}</span>
              <span>·</span>
              <span>{formatPrepTime(product.avgPrepTimeMinutes)}</span>
            </div>
            {product.description && <p className="mt-2 text-sm text-[var(--color-text-muted)]">{product.description}</p>}
            {product.composition && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Склад: {product.composition}</p>
            )}
          </div>

          <div className="flex gap-2">
            {[ServiceTypeEnum.TAKEAWAY, ServiceTypeEnum.DINE_IN].map((t) => (
              <button
                key={t}
                onClick={() => setServiceType(t)}
                className={`flex-1 rounded-xl border py-2 text-sm font-medium transition ${
                  serviceType === t
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-gray-200 text-[var(--color-text-muted)]'
                }`}
              >
                {t === ServiceTypeEnum.TAKEAWAY ? '🥡 З собою' : '🍽 У закладі'}
              </button>
            ))}
          </div>

          <input
            value={allergens}
            onChange={(e) => setAllergens(e.target.value)}
            placeholder="Алергени (необов'язково)"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          <input
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="Побажання (необов'язково)"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-muted)]">Кількість</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-9 w-9 rounded-full bg-[var(--color-surface)] text-lg font-medium"
              >
                −
              </button>
              <span className="w-6 text-center font-semibold">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                className="h-9 w-9 rounded-full bg-[var(--color-surface)] text-lg font-medium"
              >
                +
              </button>
            </div>
          </div>

          <PrimaryButton onClick={handleAdd}>
            Додати · {formatUah(product.priceUahCents * quantity)}
          </PrimaryButton>
        </div>
      )}
    </Sheet>
  );
}
