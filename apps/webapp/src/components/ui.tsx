import type { ChangeEvent, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
    </div>
  );
}

export function CenterState({ icon, title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {icon && <span className="text-4xl">{icon}</span>}
      <p className="text-base font-medium text-[var(--color-text)]">{title}</p>
      {subtitle && <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="text-4xl">⚠️</span>
      <p className="text-sm text-[var(--color-text-muted)]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-white active:opacity-80"
        >
          Спробувати ще раз
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-2xl bg-[var(--color-primary)] px-5 py-3.5 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function RangeSlider({
  min = 0,
  max,
  value,
  onChange,
  onCommit,
  className,
}: {
  min?: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || draggingRef.current) return;
    input.value = String(value);
  }, [value]);

  const handlePointerDown = (e: PointerEvent<HTMLInputElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: PointerEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (input.hasPointerCapture(e.pointerId)) {
      input.releasePointerCapture(e.pointerId);
    }
    draggingRef.current = false;
    const next = Number(input.value);
    onChange(next);
    onCommit?.(next);
  };

  const handlePointerCancel = () => {
    draggingRef.current = false;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
    const next = Number(e.currentTarget.value);
    onChange(next);
    onCommit?.(next);
  };

  return (
    <input
      ref={inputRef}
      type="range"
      min={min}
      max={max}
      step={1}
      defaultValue={value}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onChange={handleChange}
      onKeyUp={handleKeyUp}
      className={`range-input w-full accent-[var(--color-primary)] ${className ?? ''}`}
    />
  );
}
