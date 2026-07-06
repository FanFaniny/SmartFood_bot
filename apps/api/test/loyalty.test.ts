import { loadTenantConfig } from '@smartfood/config';
import { describe, expect, it } from 'vitest';

import {
  computeEarnedPoints,
  maxSpendablePoints,
  pointValueCents,
  pointsToDiscountCents,
} from '../dist/services/loyaltyService.js';

// default.client.json: earnRatePercent=5, pointToUah=0.1, maxSpendPercentOfOrder=30
const config = loadTenantConfig('demo-cafe');

describe('loyalty pricing', () => {
  it('1 бал = 10 копійок', () => {
    expect(pointValueCents(config)).toBe(10);
  });

  it('нараховує 5% від суми у балах', () => {
    // 100.00 ₴ -> 5% = 5.00 ₴ -> /0.10 = 50 балів
    expect(computeEarnedPoints(10_000, config)).toBe(50);
    expect(computeEarnedPoints(9_000, config)).toBe(45);
    expect(computeEarnedPoints(0, config)).toBe(0);
  });

  it('конвертує бали у знижку (копійки)', () => {
    expect(pointsToDiscountCents(50, config)).toBe(500);
    expect(pointsToDiscountCents(-5, config)).toBe(0);
  });

  it('обмежує списання балів % від суми та балансом', () => {
    // subtotal 100.00 ₴, max 30% = 30.00 ₴ -> /0.10 = 300 балів
    expect(maxSpendablePoints(10_000, 1_000, config)).toBe(300);
    // баланс менший за ліміт
    expect(maxSpendablePoints(10_000, 100, config)).toBe(100);
    // нульовий баланс
    expect(maxSpendablePoints(10_000, 0, config)).toBe(0);
  });
});
