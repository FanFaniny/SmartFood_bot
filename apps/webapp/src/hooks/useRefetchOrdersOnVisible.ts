import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** Перезапрашивает заказы, когда пользователь возвращается из внешней оплаты. */
export function useRefetchOrdersOnVisible() {
  const qc = useQueryClient();

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order'] });
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [qc]);
}
