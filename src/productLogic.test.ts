import { describe, expect, it } from 'vitest';
import { calculateShelfLife, formatRemainingTime, groupProducts } from './productLogic';
import type { Product } from './types';

const now = new Date('2026-05-02T10:00:00.000Z');

function product(patch: Partial<Product>): Product {
  return {
    id: patch.id ?? 'id',
    title: patch.title ?? 'Тестовый продукт',
    category: patch.category ?? 'Демо',
    addedAt: '2026-05-01T10:00:00.000Z',
    userReminderOffsetsHours: [24],
    status: patch.status ?? 'sealed',
    ...patch,
  };
}

describe('calculateShelfLife', () => {
  it('uses expiryDate for sealed products', () => {
    const result = calculateShelfLife(product({ expiryDate: '2026-05-04T09:00:00.000Z' }), now);

    expect(result.group).toBe('soon');
    expect(result.effectiveStatus).toBe('sealed');
  });

  it('uses openedAt plus openShelfLifeHours for opened products', () => {
    const result = calculateShelfLife(
      product({
        status: 'opened',
        expiryDate: '2026-05-30T10:00:00.000Z',
        openedAt: '2026-05-01T22:00:00.000Z',
        openShelfLifeHours: 24,
      }),
      now
    );

    expect(result.group).toBe('urgent');
  });

  it('marks overdue products as expired', () => {
    const result = calculateShelfLife(product({ expiryDate: '2026-05-01T10:00:00.000Z' }), now);

    expect(result.group).toBe('urgent');
    expect(result.effectiveStatus).toBe('expired');
  });
});

describe('groupProducts', () => {
  it('groups products by shelf life window', () => {
    const groups = groupProducts(
      [
        product({ id: 'urgent', title: 'A', expiryDate: '2026-05-02T20:00:00.000Z' }),
        product({ id: 'soon', title: 'B', expiryDate: '2026-05-04T08:00:00.000Z' }),
        product({ id: 'normal', title: 'C', expiryDate: '2026-05-10T10:00:00.000Z' }),
        product({ id: 'no-date', title: 'D' }),
      ],
      now
    );

    expect(groups.urgent).toHaveLength(1);
    expect(groups.soon).toHaveLength(1);
    expect(groups.normal).toHaveLength(1);
    expect(groups.noDate).toHaveLength(1);
  });
});

describe('formatRemainingTime', () => {
  it('formats hours, days and overdue values', () => {
    expect(formatRemainingTime(2 * 60 * 60 * 1000)).toBe('осталось 2 ч');
    expect(formatRemainingTime(26 * 60 * 60 * 1000)).toBe('осталось 2 д');
    expect(formatRemainingTime(-3 * 60 * 60 * 1000)).toBe('просрочено на 3 ч');
  });
});
