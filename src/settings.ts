import type { ReminderSettings } from './types';

const SETTINGS_KEY = 'fridge-mark:reminder-settings';
const DEFAULT_SETTINGS: ReminderSettings = {
  defaultOffsetsHours: [24, 72],
};

export function getReminderSettings(): ReminderSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as ReminderSettings;
    return {
      defaultOffsetsHours: Array.isArray(parsed.defaultOffsetsHours)
        ? parsed.defaultOffsetsHours.filter((value) => Number.isFinite(value) && value > 0)
        : DEFAULT_SETTINGS.defaultOffsetsHours,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveReminderSettings(settings: ReminderSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
