import type { Product, ProductShelfLife, ProductStatus, ShelfLifeGroup } from './types';

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export const GROUP_LABELS: Record<ShelfLifeGroup, string> = {
  urgent: 'Срочно',
  soon: 'Скоро',
  normal: 'Нормально',
  noDate: 'Без даты',
};

export const STATUS_LABELS: Record<ProductStatus, string> = {
  sealed: 'Закрыт',
  opened: 'Открыт',
  consumed: 'Съеден',
  discarded: 'Выброшен',
  expired: 'Просрочен',
};

export function getDueDate(product: Product): string | undefined {
  if (product.status === 'opened') {
    if (!product.openedAt || !product.openShelfLifeHours) {
      return undefined;
    }

    return new Date(new Date(product.openedAt).getTime() + product.openShelfLifeHours * HOUR_MS).toISOString();
  }

  if (product.status === 'sealed' || product.status === 'expired') {
    return product.expiryDate;
  }

  return undefined;
}

export function calculateShelfLife(product: Product, now = new Date()): ProductShelfLife {
  if (product.status === 'consumed' || product.status === 'discarded') {
    return {
      group: 'normal',
      effectiveStatus: product.status,
    };
  }

  const dueAt = getDueDate(product);
  if (!dueAt) {
    return {
      group: 'noDate',
      effectiveStatus: product.status,
    };
  }

  const dueTime = new Date(dueAt).getTime();
  const remainingMs = dueTime - now.getTime();

  if (Number.isNaN(dueTime) || remainingMs < 0) {
    return {
      group: 'urgent',
      effectiveStatus: 'expired',
      dueAt,
      remainingMs: Number.isNaN(dueTime) ? undefined : remainingMs,
    };
  }

  if (remainingMs < DAY_MS) {
    return {
      group: 'urgent',
      effectiveStatus: product.status,
      dueAt,
      remainingMs,
    };
  }

  if (remainingMs < 3 * DAY_MS) {
    return {
      group: 'soon',
      effectiveStatus: product.status,
      dueAt,
      remainingMs,
    };
  }

  return {
    group: 'normal',
    effectiveStatus: product.status,
    dueAt,
    remainingMs,
  };
}

export function groupProducts(products: Product[], now = new Date()): Record<ShelfLifeGroup, Product[]> {
  const groups: Record<ShelfLifeGroup, Product[]> = {
    urgent: [],
    soon: [],
    normal: [],
    noDate: [],
  };

  for (const product of products) {
    groups[calculateShelfLife(product, now).group].push(product);
  }

  for (const group of Object.values(groups)) {
    group.sort((a, b) => {
      const aDue = getDueDate(a);
      const bDue = getDueDate(b);
      if (!aDue && !bDue) return a.title.localeCompare(b.title, 'ru');
      if (!aDue) return 1;
      if (!bDue) return -1;
      return new Date(aDue).getTime() - new Date(bDue).getTime();
    });
  }

  return groups;
}

export function formatRemainingTime(remainingMs?: number): string {
  if (remainingMs === undefined) {
    return 'срок неизвестен';
  }

  if (remainingMs < 0) {
    const hoursOverdue = Math.ceil(Math.abs(remainingMs) / HOUR_MS);
    if (hoursOverdue < 24) {
      return `просрочено на ${hoursOverdue} ч`;
    }

    return `просрочено на ${Math.ceil(hoursOverdue / 24)} д`;
  }

  const hours = Math.ceil(remainingMs / HOUR_MS);
  if (hours < 24) {
    return `осталось ${hours} ч`;
  }

  return `осталось ${Math.ceil(hours / 24)} д`;
}
