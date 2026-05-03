import { BrowserCodeReader, BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import './styles.css';
import { parseGs1Code, type ParsedGs1Code } from './gs1Parser';
import {
  GROUP_LABELS,
  STATUS_LABELS,
  calculateShelfLife,
  formatRemainingTime,
  getDueDate,
  groupProducts,
} from './productLogic';
import { getReminderSettings, saveReminderSettings } from './settings';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  seedDemoData,
  updateProduct,
} from './storage';
import type { Product, ProductInput, ProductStatus, ShelfLifeGroup } from './types';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

const appRoot = app;

const quickExpiryDays = [
  ['Сегодня', 0],
  ['Завтра', 1],
  ['+3 дня', 3],
  ['+7 дней', 7],
  ['+14 дней', 14],
  ['+30 дней', 30],
] as const;

const quickOpenLifeHours = [
  ['12 часов', 12],
  ['1 день', 24],
  ['2 дня', 48],
  ['3 дня', 72],
  ['7 дней', 168],
] as const;

const groupOrder: ShelfLifeGroup[] = ['urgent', 'soon', 'normal', 'noDate'];

let photoDraftDataUrl: string | undefined;
let scannerControls: IScannerControls | undefined;
let lastScanRaw: string | undefined;
let lastScanParsed: ParsedGs1Code | undefined;

function navigate(hash: string): void {
  window.location.hash = hash;
}

function todayDateValue(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function dateInputToIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T23:59:59`).toISOString();
}

function setView(title: string, body: string): void {
  appRoot.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <a class="brand" href="#/">Fridge Mark</a>
        <nav class="top-actions" aria-label="Навигация">
          <a class="icon-link" href="#/scan" aria-label="Сканирование">⌗</a>
          <a class="icon-link" href="#/settings" aria-label="Настройки">⚙</a>
        </nav>
      </header>
      <section class="screen">
        <div class="screen-title">
          <h1>${title}</h1>
        </div>
        ${body}
      </section>
      <nav class="bottom-nav" aria-label="Основные действия">
        <a href="#/" class="bottom-link">Список</a>
        <a href="#/add" class="bottom-primary">Добавить</a>
        <a href="#/scan" class="bottom-link">Сканер</a>
      </nav>
    </main>
  `;
}

function stopScanner(): void {
  scannerControls?.stop();
  scannerControls = undefined;
  BrowserCodeReader.releaseAllStreams();
}

function escapeHtml(value = ''): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[char];
  });
}

function escapeVisibleRaw(value = ''): string {
  return escapeHtml(value.split(String.fromCharCode(29)).join('<GS>'));
}

function renderProductCard(product: Product): string {
  const shelfLife = calculateShelfLife(product);
  const dueAt = getDueDate(product);
  const photo = product.photoDataUrl
    ? `<img class="product-thumb" src="${product.photoDataUrl}" alt="${escapeHtml(product.title)}" />`
    : `<div class="product-thumb product-thumb-empty" aria-hidden="true"></div>`;

  return `
    <a class="product-row group-${shelfLife.group}" href="#/product/${product.id}">
      ${photo}
      <span class="product-row-main">
        <strong>${escapeHtml(product.title)}</strong>
        <span>${escapeHtml(product.category)} · ${STATUS_LABELS[shelfLife.effectiveStatus]}</span>
      </span>
      <span class="product-row-meta">
        <span>${formatRemainingTime(shelfLife.remainingMs)}</span>
        <small>${dueAt ? new Date(dueAt).toLocaleDateString('ru-RU') : 'нет даты'}</small>
      </span>
    </a>
  `;
}

function renderParsedGs1(parsed?: ParsedGs1Code): string {
  if (!parsed) {
    return '<p class="muted">Код еще не считан.</p>';
  }

  const expiry = parsed.expiryDateTime ?? parsed.expiryDate ?? parsed.bestBeforeDate;
  const missingExpiryMessage =
    (parsed.gtin || parsed.serial) && !expiry
      ? '<p class="scanner-note">Срок годности не найден в коде. Его можно указать вручную при редактировании продукта.</p>'
      : '';

  return `
    ${missingExpiryMessage}
    <dl class="details-list scanner-details">
      <dt>GTIN</dt><dd>${escapeHtml(parsed.gtin ?? 'Не найден')}</dd>
      <dt>Серийный номер</dt><dd>${escapeHtml(parsed.serial ?? 'Не найден')}</dd>
      <dt>Партия</dt><dd>${escapeHtml(parsed.batch ?? 'Не найдена')}</dd>
      <dt>Дата производства</dt><dd>${escapeHtml(parsed.productionDate ?? 'Не найдена')}</dd>
      <dt>Срок годности</dt><dd>${escapeHtml(expiry ?? 'Не найден')}</dd>
      <dt>Confidence</dt><dd>${parsed.confidence}</dd>
      <dt>Служебные поля маркировки</dt><dd>${
        parsed.serviceAis.length
          ? parsed.serviceAis.map((item) => `${escapeHtml(item.ai)}=${escapeHtml(item.value)}`).join('<br />')
          : 'Нет'
      }</dd>
      <dt>Неизвестные AI</dt><dd>${
        parsed.unknownAis.length
          ? parsed.unknownAis.map((item) => `${escapeHtml(item.ai)}=${escapeHtml(item.value)}`).join('<br />')
          : 'Нет'
      }</dd>
      <dt>Ошибки</dt><dd>${
        parsed.errors.length ? parsed.errors.map((error) => escapeHtml(error)).join('<br />') : 'Нет'
      }</dd>
    </dl>
  `;
}

function updateScanResult(raw: string): void {
  lastScanRaw = raw;
  lastScanParsed = parseGs1Code(raw);

  const rawBox = document.querySelector<HTMLElement>('#scan-raw');
  const parsedBox = document.querySelector<HTMLElement>('#scan-parsed');
  const createButton = document.querySelector<HTMLButtonElement>('#create-from-code');

  if (rawBox) {
    rawBox.innerHTML = escapeVisibleRaw(raw);
  }

  if (parsedBox) {
    parsedBox.innerHTML = renderParsedGs1(lastScanParsed);
  }

  if (createButton) {
    createButton.disabled = !lastScanRaw;
  }
}

function setScannerMessage(message: string, isError = false): void {
  const box = document.querySelector<HTMLElement>('#scanner-message');
  if (box) {
    box.className = isError ? 'scanner-message error' : 'scanner-message';
    box.textContent = message;
  }
}

async function renderHome(): Promise<void> {
  const products = await listProducts();
  const groups = groupProducts(products);
  const content = `
    <div class="hero-actions">
      <a class="primary-button" href="#/add">Добавить вручную</a>
      <a class="secondary-button" href="#/scan">Сканировать код</a>
    </div>
    ${
      products.length === 0
        ? `<div class="empty-state">
            <h2>Холодильник пока пуст</h2>
            <p>Добавьте продукт вручную или включите демо-данные для проверки группировки сроков.</p>
            <button class="secondary-button" id="seed-demo">Демо-данные</button>
          </div>`
        : groupOrder
            .map((group) => {
              const items = groups[group];
              return `
                <section class="product-group">
                  <h2>${GROUP_LABELS[group]} <span>${items.length}</span></h2>
                  ${items.length ? items.map(renderProductCard).join('') : '<p class="muted">Нет продуктов в группе</p>'}
                </section>
              `;
            })
            .join('')
    }
  `;

  setView('Продукты', content);
  document.querySelector('#seed-demo')?.addEventListener('click', async () => {
    await seedDemoData();
    await renderHome();
  });
}

function formValue(form: HTMLFormElement, name: string): string {
  return String(new FormData(form).get(name) ?? '').trim();
}

async function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderPhotoPreview(): void {
  const preview = document.querySelector<HTMLDivElement>('#photo-preview');
  if (!preview) {
    return;
  }

  preview.innerHTML = photoDraftDataUrl
    ? `<img src="${photoDraftDataUrl}" alt="Фото продукта" /><button type="button" class="danger-button" id="remove-photo">Удалить фото</button>`
    : `<p class="muted">Фото не выбрано</p>`;
  document.querySelector('#remove-photo')?.addEventListener('click', () => {
    photoDraftDataUrl = undefined;
    renderPhotoPreview();
  });
}

function addDateQuickButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-expiry-days]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.querySelector<HTMLInputElement>('#expiryDate');
      if (input) {
        input.value = todayDateValue(Number(button.dataset.expiryDays));
      }
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-open-hours]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.querySelector<HTMLInputElement>('#openShelfLifeHours');
      if (input) {
        input.value = String(button.dataset.openHours);
      }
    });
  });
}

async function renderAddProduct(): Promise<void> {
  photoDraftDataUrl = undefined;
  const reminderSettings = getReminderSettings();
  setView(
    'Добавить продукт',
    `
      <form class="form-stack" id="product-form">
        <label>
          Название
          <input name="title" required autocomplete="off" placeholder="Молоко, сыр, курица" />
        </label>
        <label>
          Категория
          <input name="category" autocomplete="off" placeholder="Молочное" />
        </label>
        <label>
          Срок годности закрытого продукта
          <input id="expiryDate" name="expiryDate" type="date" />
        </label>
        <div class="quick-grid" aria-label="Быстрый выбор даты">
          ${quickExpiryDays.map(([label, days]) => `<button type="button" data-expiry-days="${days}">${label}</button>`).join('')}
        </div>
        <label>
          Срок после открытия, часов
          <input id="openShelfLifeHours" name="openShelfLifeHours" type="number" min="1" inputmode="numeric" placeholder="24" />
        </label>
        <div class="quick-grid" aria-label="Быстрый выбор срока после открытия">
          ${quickOpenLifeHours.map(([label, hours]) => `<button type="button" data-open-hours="${hours}">${label}</button>`).join('')}
        </div>
        <label>
          Фото продукта
          <input id="photo-file" type="file" accept="image/*" />
        </label>
        <div class="photo-preview" id="photo-preview"></div>
        <label>
          Заметки
          <textarea name="notes" rows="3" placeholder="Полка, особенности хранения"></textarea>
        </label>
        <p class="muted">Напоминания для продукта: ${reminderSettings.defaultOffsetsHours.join(', ')} ч до срока.</p>
        <button class="primary-button" type="submit">Сохранить</button>
      </form>
    `
  );

  renderPhotoPreview();
  addDateQuickButtons();

  document.querySelector<HTMLInputElement>('#photo-file')?.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      photoDraftDataUrl = await readPhoto(file);
      renderPhotoPreview();
    }
  });

  document.querySelector<HTMLFormElement>('#product-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const openShelfLifeHours = Number(formValue(form, 'openShelfLifeHours'));
    const input: ProductInput = {
      title: formValue(form, 'title'),
      category: formValue(form, 'category') || 'Без категории',
      expiryDate: dateInputToIso(formValue(form, 'expiryDate')),
      openShelfLifeHours: Number.isFinite(openShelfLifeHours) && openShelfLifeHours > 0 ? openShelfLifeHours : undefined,
      photoDataUrl: photoDraftDataUrl,
      notes: formValue(form, 'notes') || undefined,
    };
    const product = await createProduct(input);
    navigate(`#/product/${product.id}`);
  });
}

async function renderProductDetail(id: string): Promise<void> {
  const product = await getProduct(id);
  if (!product) {
    setView('Не найдено', '<p class="muted">Продукт не найден или был удален.</p>');
    return;
  }

  const shelfLife = calculateShelfLife(product);
  const dueAt = getDueDate(product);
  setView(
    product.title,
    `
      <article class="detail-card">
        ${
          product.photoDataUrl
            ? `<img class="detail-photo" src="${product.photoDataUrl}" alt="${escapeHtml(product.title)}" />`
            : '<div class="detail-photo detail-photo-empty"></div>'
        }
        <div class="status-pill group-${shelfLife.group}">${GROUP_LABELS[shelfLife.group]} · ${formatRemainingTime(shelfLife.remainingMs)}</div>
        <dl class="details-list">
          <dt>Категория</dt><dd>${escapeHtml(product.category)}</dd>
          <dt>Статус</dt><dd>${STATUS_LABELS[shelfLife.effectiveStatus]}</dd>
          <dt>Срок</dt><dd>${dueAt ? new Date(dueAt).toLocaleString('ru-RU') : 'Не указан'}</dd>
          <dt>Добавлен</dt><dd>${new Date(product.addedAt).toLocaleString('ru-RU')}</dd>
          <dt>После открытия</dt><dd>${product.openShelfLifeHours ? `${product.openShelfLifeHours} ч` : 'Не указано'}</dd>
          <dt>GTIN</dt><dd>${escapeHtml(product.gtin ?? 'Будет извлечен в PR002')}</dd>
          <dt>Код</dt><dd>${escapeHtml(product.rawCode ?? 'Сканер будет реализован в PR002')}</dd>
        </dl>
        ${product.notes ? `<p class="notes">${escapeHtml(product.notes)}</p>` : ''}
        <form class="form-stack compact" id="status-form">
          <label>
            Изменить статус
            <select name="status">
              ${Object.entries(STATUS_LABELS)
                .map(([value, label]) => `<option value="${value}" ${product.status === value ? 'selected' : ''}>${label}</option>`)
                .join('')}
            </select>
          </label>
          <button class="secondary-button" type="submit">Обновить статус</button>
        </form>
        <button class="danger-button full-width" id="delete-product" type="button">Удалить продукт</button>
      </article>
    `
  );

  document.querySelector<HTMLFormElement>('#status-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const status = formValue(form, 'status') as ProductStatus;
    await updateProduct(product.id, {
      status,
      openedAt: status === 'opened' ? product.openedAt ?? new Date().toISOString() : product.openedAt,
    });
    await renderProductDetail(product.id);
  });

  document.querySelector('#delete-product')?.addEventListener('click', async () => {
    await deleteProduct(product.id);
    navigate('#/');
  });
}

async function startScanner(): Promise<void> {
  if (scannerControls) {
    setScannerMessage('Сканирование уже запущено.');
    return;
  }

  const video = document.querySelector<HTMLVideoElement>('#scanner-video');
  if (!video) {
    return;
  }

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE]);
  const reader = new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 250,
    delayBetweenScanSuccess: 800,
    tryPlayVideoTimeout: 5000,
  });

  setScannerMessage('Запрашиваем доступ к камере...');

  try {
    scannerControls = await reader.decodeFromConstraints(
      {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      video,
      (result, error) => {
        if (result) {
          updateScanResult(result.getText());
          setScannerMessage('Код считан. Проверьте поля перед созданием продукта.');
        }

        if (error && error.name !== 'NotFoundException') {
          setScannerMessage(`Камера работает, но код не распознан: ${error.message}`, true);
        }
      }
    );
    setScannerMessage('Сканирование запущено. Держите код в центре кадра.');
  } catch (error) {
    scannerControls = undefined;
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка камеры.';
    setScannerMessage(`Камера недоступна или разрешение не выдано. ${message}`, true);
  }
}

async function createProductFromLastCode(): Promise<void> {
  if (!lastScanRaw || !lastScanParsed) {
    return;
  }

  const expiryDate = lastScanParsed.expiryDateTime ?? lastScanParsed.expiryDate ?? lastScanParsed.bestBeforeDate;
  const product = await createProduct({
    title: lastScanParsed.gtin ? `Продукт ${lastScanParsed.gtin}` : 'Сканированный продукт',
    category: 'Без категории',
    rawCode: lastScanRaw,
    parsedCode: lastScanParsed,
    gtin: lastScanParsed.gtin,
    serial: lastScanParsed.serial,
    batch: lastScanParsed.batch,
    productionDate: lastScanParsed.productionDate,
    expiryDate,
    status: 'sealed',
  });

  stopScanner();
  navigate(`#/product/${product.id}`);
}

function renderScan(): void {
  lastScanRaw = undefined;
  lastScanParsed = undefined;
  setView(
    'Сканирование',
    `
      <section class="scanner-panel">
        <p class="muted">Сканирование работает локально. Если код не распознался, можно вставить строку вручную или добавить продукт без кода.</p>
        <div class="scanner-frame">
          <video id="scanner-video" playsinline muted></video>
          <div class="scanner-target" aria-hidden="true"></div>
        </div>
        <div class="hero-actions">
          <button class="primary-button" id="start-scanner" type="button">Начать сканирование</button>
          <button class="secondary-button" id="stop-scanner" type="button">Остановить</button>
        </div>
        <p id="scanner-message" class="scanner-message">Код нужно держать в центре кадра.</p>
      </section>

      <section class="product-group">
        <h2>Последний raw-код</h2>
        <pre class="raw-code" id="scan-raw">Код еще не считан.</pre>
      </section>

      <section class="product-group">
        <h2>Результат парсинга</h2>
        <div class="detail-card" id="scan-parsed">${renderParsedGs1()}</div>
        <button class="primary-button full-width" id="create-from-code" type="button" disabled>Создать продукт из кода</button>
      </section>

      <section class="product-group">
        <h2>Ручной ввод raw-кода</h2>
        <form class="form-stack" id="manual-code-form">
          <label>
            Raw-код
            <textarea name="rawCode" rows="5" placeholder="(01)04601234567890(17)260501(21)ABC123"></textarea>
          </label>
          <button class="secondary-button" type="submit">Распарсить</button>
        </form>
        <a class="secondary-button full-width add-without-code" href="#/add">Добавить продукт без кода</a>
      </section>
    `
  );

  document.querySelector('#start-scanner')?.addEventListener('click', () => {
    void startScanner();
  });

  document.querySelector('#stop-scanner')?.addEventListener('click', () => {
    stopScanner();
    setScannerMessage('Сканирование остановлено.');
  });

  document.querySelector('#create-from-code')?.addEventListener('click', () => {
    void createProductFromLastCode();
  });

  document.querySelector<HTMLFormElement>('#manual-code-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    updateScanResult(formValue(form, 'rawCode'));
    setScannerMessage('Raw-код распарсен из ручного ввода.');
  });
}

function renderSettings(): void {
  const settings = getReminderSettings();
  const knownOffsets = [12, 24, 48, 72, 168];
  setView(
    'Напоминания',
    `
      <form class="form-stack" id="settings-form">
        <p class="muted">В PR001 настройки сохраняются локально и применяются к новым продуктам. Надежные уведомления запланированы для Capacitor APK.</p>
        <fieldset>
          <legend>Напоминать до срока</legend>
          ${knownOffsets
            .map(
              (hours) => `
                <label class="check-row">
                  <input type="checkbox" name="offset" value="${hours}" ${settings.defaultOffsetsHours.includes(hours) ? 'checked' : ''} />
                  ${hours < 24 ? `${hours} ч` : `${hours / 24} д`}
                </label>
              `
            )
            .join('')}
        </fieldset>
        <button class="primary-button" type="submit">Сохранить настройки</button>
      </form>
    `
  );

  document.querySelector<HTMLFormElement>('#settings-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    saveReminderSettings({
      defaultOffsetsHours: data.getAll('offset').map(Number).filter(Boolean),
    });
    renderSettings();
  });
}

async function renderRoute(): Promise<void> {
  const hash = window.location.hash || '#/';
  if (hash !== '#/scan') {
    stopScanner();
  }

  if (hash === '#/' || hash === '#') {
    await renderHome();
    return;
  }

  if (hash === '#/add') {
    await renderAddProduct();
    return;
  }

  if (hash === '#/scan') {
    renderScan();
    return;
  }

  if (hash === '#/settings') {
    renderSettings();
    return;
  }

  if (hash.startsWith('#/product/')) {
    await renderProductDetail(hash.replace('#/product/', ''));
    return;
  }

  navigate('#/');
}

window.addEventListener('hashchange', () => {
  void renderRoute();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

void renderRoute();
