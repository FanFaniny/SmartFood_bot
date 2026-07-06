import type { Product } from '@smartfood/shared';

import { formatMeasure, formatPrepTime, formatUah } from '../lib/format';

export function ProductCard({ product, onSelect }: { product: Product; onSelect: (p: Product) => void }) {
  return (
    <button
      onClick={() => onSelect(product)}
      className="flex w-full gap-3 rounded-2xl bg-[var(--color-surface)] p-3 text-left transition active:scale-[0.99]"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-200">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate font-medium text-[var(--color-text)]">{product.name}</p>
        {product.composition && (
          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-text-muted)]">{product.composition}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-[var(--color-text-muted)]">
          <span>{formatMeasure(product.measureValue, product.measureUnit)}</span>
          <span>·</span>
          <span>{formatPrepTime(product.avgPrepTimeMinutes)}</span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-1.5">
          <span className="font-semibold text-[var(--color-text)]">{formatUah(product.priceUahCents)}</span>
          <span className="rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white">
            Додати
          </span>
        </div>
      </div>
    </button>
  );
}
