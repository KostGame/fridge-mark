# Data Model

## Product

```ts
type ProductStatus = 'sealed' | 'opened' | 'consumed' | 'discarded' | 'expired';

interface Product {
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
```

## Поля DataMatrix

В PR001 реальные сканирование и парсинг не реализованы. Поля `rawCode`, `parsedCode`, `gtin`, `serial`, `batch`, `productionDate` и `expiryDate` уже есть в модели, чтобы PR002 мог сохранить полный raw DataMatrix и локально извлеченные значения.

## Расчет срока

- Для `sealed` используется `expiryDate`.
- Для `opened` используется `openedAt + openShelfLifeHours`.
- Если даты нет, продукт попадает в группу «Без даты».
- Если срок прошел, эффективный статус считается `expired`.
- Если осталось меньше 24 часов, группа «Срочно».
- Если осталось меньше 72 часов, группа «Скоро».
- Иначе группа «Нормально».
