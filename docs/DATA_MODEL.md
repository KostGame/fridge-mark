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
  parsedCode?: ParsedGs1Code;
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

В PR002 экран сканирования сохраняет полный `rawCode` и объект результата парсинга `parsedCode`. Известные поля также копируются в верхний уровень продукта: `gtin`, `serial`, `batch`, `productionDate`, `expiryDate`.

`expiryDate` заполняется в порядке приоритета: `expiryDateTime`, `expiryDate`, `bestBeforeDate`. Значение AI `7003` хранится как локальная дата-время без timezone в формате `YYYY-MM-DDTHH:mm`.

## Расчет срока

- Для `sealed` используется `expiryDate`.
- Для `opened` используется `openedAt + openShelfLifeHours`.
- Если даты нет, продукт попадает в группу «Без даты».
- Если срок прошел, эффективный статус считается `expired`.
- Если осталось меньше 24 часов, группа «Срочно».
- Если осталось меньше 72 часов, группа «Скоро».
- Иначе группа «Нормально».
