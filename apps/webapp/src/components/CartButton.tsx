import { formatUah } from '../lib/format';

export function CartButton({
  count,
  subtotalCents,
  onClick,
}: {
  count: number;
  subtotalCents: number;
  onClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none sticky bottom-3 z-20 px-4">
      <button
        onClick={onClick}
        className="pointer-events-auto flex w-full items-center justify-between rounded-2xl bg-[var(--color-primary)] px-5 py-3.5 text-white shadow-lg transition active:scale-[0.99]"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs">
            {count}
          </span>
          Кошик
        </span>
        <span className="font-semibold">{formatUah(subtotalCents)}</span>
      </button>
    </div>
  );
}
