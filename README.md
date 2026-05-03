# Fridge Mark

Fridge Mark / «Холодильник по Честному знаку» — mobile-first PWA для локального учета продуктов в холодильнике. Пользователь добавляет продукт, дату покупки или добавления, срок годности закрытого продукта, статус открытия, срок хранения после открытия, фото и заметки. Приложение группирует продукты по срочности и готовит основу для будущего сканирования GS1 DataMatrix / Честный знак.

PR002 добавляет локальное сканирование DataMatrix / QR через ZXing и парсер GS1 Application Identifiers. Все пользовательские данные хранятся локально в браузере через IndexedDB. Официальный API Честного знака, backend и Android APK пока не реализованы.

## Запуск локально

```bash
npm install
npm run dev
```

Vite покажет локальный адрес. На Android в той же сети удобно открыть LAN URL из вывода Vite.

## Сборка

```bash
npm run build
```

Готовые файлы появятся в `dist/`.

## Тесты

```bash
npm test
```

## Публикация на GitHub Pages

Приложение публикуется через GitHub Actions workflow `.github/workflows/deploy-pages.yml` после push в `main`. Workflow устанавливает зависимости через `npm ci`, запускает `npm test`, выполняет `npm run build` и публикует каталог `dist/` через GitHub Pages.

Ожидаемый URL после деплоя:

```text
https://kostgame.github.io/fridge-mark/
```

В настройках репозитория нужно включить публикацию из GitHub Actions:

```text
Settings → Pages → Source: GitHub Actions
```

Конфиг Vite использует `base: './'`, поэтому сборка пригодна для размещения в подпапке GitHub Pages. Данные IndexedDB из локального dev-сервера не переносятся автоматически на GitHub Pages: это разные browser origins, и пользовательские данные остаются локальными для каждого адреса.

## Пока не реализовано

- интеграция с официальным API Честного знака;
- поиск названия товара по GTIN;
- backend и синхронизация между устройствами;
- Android APK через Capacitor;
- надежные локальные уведомления.

## Документация

- [Продукт](docs/PRODUCT.md)
- [Архитектура](docs/ARCHITECTURE.md)
- [Модель данных](docs/DATA_MODEL.md)
- [Roadmap](docs/ROADMAP.md)
- [Решения](docs/DECISIONS.md)
- [GS1 Parser](docs/GS1_PARSER.md)
