import type { ReactNode } from 'react';
import { useEffect } from 'react';

export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 animate-[fade_0.15s_ease]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-[var(--color-bg)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-[slideup_0.2s_ease]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-300" />
        {children}
      </div>
    </div>
  );
}
