import type { MeasureUnit } from '@smartfood/shared';

export function formatUah(cents: number): string {
  const value = cents / 100;
  return `${value.toLocaleString('uk-UA', { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} ₴`;
}

export function formatMeasure(value: number, unit: MeasureUnit): string {
  return unit === 'g' ? `${value} г` : `${value} мл`;
}

export function formatPrepTime(minutes: number): string {
  return `~${minutes} хв за шт.`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
