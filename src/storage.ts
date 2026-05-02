import { getReminderSettings } from './settings';
import type { Product, ProductInput, ProductPatch } from './types';

const DB_NAME = 'fridge-mark';
const DB_VERSION = 1;
const STORE_NAME = 'products';

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('addedAt', 'addedAt');
          store.createIndex('status', 'status');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

function productStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function listProducts(): Promise<Product[]> {
  const db = await openDb();
  const products = await requestToPromise<Product[]>(productStore(db, 'readonly').getAll());
  return products.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await openDb();
  return requestToPromise<Product | undefined>(productStore(db, 'readonly').get(id));
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const db = await openDb();
  const now = new Date().toISOString();
  const product: Product = {
    ...input,
    id: createId(),
    title: input.title.trim(),
    category: input.category.trim() || 'Без категории',
    addedAt: now,
    status: input.status ?? 'sealed',
    userReminderOffsetsHours: input.userReminderOffsetsHours ?? getReminderSettings().defaultOffsetsHours,
  };

  await requestToPromise(productStore(db, 'readwrite').add(product));
  return product;
}

export async function updateProduct(id: string, patch: ProductPatch): Promise<Product | undefined> {
  const existing = await getProduct(id);
  if (!existing) {
    return undefined;
  }

  const db = await openDb();
  const updated: Product = {
    ...existing,
    ...patch,
    id,
    title: patch.title?.trim() || existing.title,
    category: patch.category?.trim() || existing.category,
  };

  await requestToPromise(productStore(db, 'readwrite').put(updated));
  return updated;
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await openDb();
  await requestToPromise(productStore(db, 'readwrite').delete(id));
}

export async function seedDemoData(): Promise<void> {
  const existing = await listProducts();
  if (existing.length > 0) {
    return;
  }

  const now = new Date();
  const isoInHours = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

  await createProduct({
    title: 'Кефир',
    category: 'Молочное',
    expiryDate: isoInHours(18),
    openShelfLifeHours: 24,
    notes: 'Демо-продукт для проверки группы Срочно.',
  });
  await createProduct({
    title: 'Куриное филе',
    category: 'Мясо',
    expiryDate: isoInHours(48),
    openShelfLifeHours: 12,
  });
  await createProduct({
    title: 'Соус томатный',
    category: 'Соусы',
    expiryDate: isoInHours(24 * 20),
    openShelfLifeHours: 72,
  });
  await createProduct({
    title: 'Сыр без даты',
    category: 'Сыр',
    openShelfLifeHours: 48,
  });
}
