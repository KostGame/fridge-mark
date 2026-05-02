export type ProductStatus = 'sealed' | 'opened' | 'consumed' | 'discarded' | 'expired';

export type ShelfLifeGroup = 'urgent' | 'soon' | 'normal' | 'noDate';

export interface Product {
  id: string;
  title: string;
  category: string;
  photoDataUrl?: string;
  rawCode?: string;
  parsedCode?: string;
  gtin?: string;
  serial?: string;
  batch?: string;
  productionDate?: string;
  expiryDate?: string;
  addedAt: string;
  purchaseDate?: string;
  openedAt?: string;
  openShelfLifeHours?: number;
  userReminderOffsetsHours: number[];
  status: ProductStatus;
  notes?: string;
}

export type ProductInput = Omit<Product, 'id' | 'addedAt' | 'status' | 'userReminderOffsetsHours'> & {
  userReminderOffsetsHours?: number[];
  status?: ProductStatus;
};

export type ProductPatch = Partial<Omit<Product, 'id'>>;

export interface ProductShelfLife {
  group: ShelfLifeGroup;
  effectiveStatus: ProductStatus;
  dueAt?: string;
  remainingMs?: number;
}

export interface ReminderSettings {
  defaultOffsetsHours: number[];
}
