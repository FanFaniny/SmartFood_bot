import type { Product } from '@smartfood/shared';

import { ProductCard } from '../components/ProductCard';
import { CenterState, ErrorState, Spinner } from '../components/ui';
import { useBootstrap, useMenu } from '../hooks/queries';

export function HomeScreen({
  onSelectProduct,
  onOpenLoyalty,
}: {
  onSelectProduct: (p: Product) => void;
  onOpenLoyalty: () => void;
}) {
  const bootstrap = useBootstrap();
  const menu = useMenu();

  const venueName = bootstrap.data?.tenant.venue.name ?? 'SmartFood';
  const loyalty = bootstrap.data?.loyalty;

  return (
    <div className="flex flex-col">
      <header className="flex items-start justify-between gap-3 px-4 pt-5 pb-3">
        <div className="min-w-0">
          <p className="text-xs text-[var(--color-text-muted)]">Ласкаво просимо до</p>
          <h1 className="truncate text-2xl font-bold">{venueName}</h1>
        </div>
        {loyalty && (
          <button
            onClick={onOpenLoyalty}
            className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--color-primary)]"
          >
            ⭐ {loyalty.pointsBalance}
          </button>
        )}
      </header>

      {menu.isLoading && <Spinner />}
      {menu.isError && <ErrorState message={(menu.error as Error).message} onRetry={() => menu.refetch()} />}
      {menu.data && menu.data.length === 0 && (
        <CenterState icon="🍽️" title="Меню порожнє" subtitle="Завітайте трохи пізніше" />
      )}

      {menu.data && menu.data.length > 0 && (
        <div className="flex flex-col gap-6 px-4 pb-4">
          {menu.data.map((category) => (
            <section key={category.id}>
              <h2 className="mb-2 text-lg font-semibold">{category.name}</h2>
              <div className="flex flex-col gap-2.5">
                {category.products.map((product) => (
                  <ProductCard key={product.id} product={product} onSelect={onSelectProduct} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
