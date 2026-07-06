import type { LoyaltyTransaction } from '@smartfood/shared';
import { LoyaltyTransactionType } from '@smartfood/shared';

import { CenterState, ErrorState, Spinner } from '../components/ui';
import { useLoyalty } from '../hooks/queries';
import { formatDateTime, formatUah } from '../lib/format';

const TX_LABEL: Record<string, string> = {
  [LoyaltyTransactionType.EARN]: 'Нараховано',
  [LoyaltyTransactionType.SPEND]: 'Списано',
  [LoyaltyTransactionType.REFUND]: 'Повернено',
  [LoyaltyTransactionType.ADJUSTMENT]: 'Коригування',
};

function sign(tx: LoyaltyTransaction): string {
  const positive = tx.type !== LoyaltyTransactionType.SPEND;
  return `${positive ? '+' : '−'}${Math.abs(tx.points)}`;
}

export function LoyaltyScreen() {
  const loyalty = useLoyalty();

  return (
    <div className="flex flex-col">
      <h1 className="px-4 pt-5 pb-3 text-2xl font-bold">Бали лояльності</h1>

      {loyalty.isLoading && <Spinner />}
      {loyalty.isError && <ErrorState message={(loyalty.error as Error).message} onRetry={() => loyalty.refetch()} />}

      {loyalty.data && (
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="rounded-3xl bg-[var(--color-primary)] p-6 text-white">
            <p className="text-sm opacity-80">Ваш баланс</p>
            <p className="mt-1 text-4xl font-bold">{loyalty.data.summary.pointsBalance} балів</p>
            <p className="mt-1 text-sm opacity-90">≈ {formatUah(loyalty.data.summary.uahEquivalentCents)}</p>
          </div>

          <div className="rounded-2xl bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)]">
            <p>📈 Нараховуємо {loyalty.data.summary.earnRatePercent}% від суми замовлення.</p>
            <p className="mt-1">💳 Балами можна оплатити до {loyalty.data.summary.maxSpendPercentOfOrder}% замовлення.</p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">Історія</h2>
            {loyalty.data.transactions.length === 0 ? (
              <CenterState icon="⭐" title="Поки що порожньо" subtitle="Робіть замовлення та отримуйте бали" />
            ) : (
              <div className="flex flex-col gap-2">
                {loyalty.data.transactions.map((tx) => {
                  const positive = tx.type !== LoyaltyTransactionType.SPEND;
                  return (
                    <div key={tx.id} className="flex items-center justify-between rounded-xl bg-[var(--color-surface)] p-3">
                      <div>
                        <p className="text-sm font-medium">{TX_LABEL[tx.type] ?? tx.type}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{formatDateTime(tx.createdAt)}</p>
                      </div>
                      <span className={`text-sm font-semibold ${positive ? 'text-[var(--color-primary)]' : 'text-rose-600'}`}>
                        {sign(tx)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
