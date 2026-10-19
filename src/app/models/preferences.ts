import { isRecord } from './auth';

export interface Preferences {
  theme: string;
  showTips: boolean;
  compact: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'light',
  showTips: true,
  compact: false
};

export function isSavedPreferences(value: unknown): value is Partial<Preferences> {
  return isRecord(value) &&
    (value['theme'] === undefined || typeof value['theme'] === 'string') &&
    (value['showTips'] === undefined || typeof value['showTips'] === 'boolean') &&
    (value['compact'] === undefined || typeof value['compact'] === 'boolean');
}
