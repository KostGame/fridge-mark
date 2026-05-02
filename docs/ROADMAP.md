# Roadmap

## PR001: PWA foundation

Статическая PWA без сервера, локальная модель данных, IndexedDB, ручное добавление продуктов, фото, расчет сроков, базовые экраны и документация.

## PR002: DataMatrix scanner and GS1 AI parser

Добавить экран камеры, чтение GS1 DataMatrix и локальный парсер Application Identifiers. Сохранять полный raw DataMatrix и извлеченные GTIN, serial, batch, productionDate, expiryDate, если они есть в коде.

## PR003: Product card and open storage rules

Улучшить карточку продукта, редактирование полей, правила хранения открытых продуктов по категориям, подсказки для срока после открытия и аккуратную историю статусов.

## PR004: Reminders

Добавить напоминания: ICS export, best effort browser notifications, проверку ближайших сроков при открытии приложения и понятные ограничения PWA-уведомлений.

## PR005: Capacitor Android APK

Упаковать PWA в Android APK через Capacitor. Подготовить надежные локальные уведомления и Android-friendly permissions flow.

## PR006: Optional backend adapter

Добавить опциональный backend adapter для внешних API и синхронизации. Backend не должен быть обязательным для локального PWA-режима.
