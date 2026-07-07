import { useEffect, useRef, useState } from 'react';

import { RangeSlider } from './ui';

export function LoyaltyPointsSlider({
  max,
  balance,
  onPreviewPointsChange,
  onLivePointsChange,
}: {
  max: number;
  balance: number;
  onPreviewPointsChange: (points: number) => void;
  onLivePointsChange: (points: number) => void;
}) {
  const [value, setValue] = useState(0);
  const counterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setValue((current) => Math.min(current, max));
  }, [max]);

  useEffect(() => {
    if (counterRef.current) {
      counterRef.current.textContent = `${value} / ${max}`;
    }
  }, [value, max]);

  const handleChange = (points: number) => {
    onLivePointsChange(points);
    if (counterRef.current) {
      counterRef.current.textContent = `${points} / ${max}`;
    }
  };

  const handleCommit = (points: number) => {
    setValue(points);
    onPreviewPointsChange(points);
  };

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Списати бали</span>
        <span ref={counterRef} className="text-[var(--color-text-muted)]">
          {value} / {max}
        </span>
      </div>
      <RangeSlider
        max={max}
        value={value}
        onChange={handleChange}
        onCommit={handleCommit}
        className="mt-2"
      />
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Баланс: {balance} балів</p>
    </div>
  );
}
