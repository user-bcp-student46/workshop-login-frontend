import { Injectable } from '@angular/core';
import { isLoginResponse, LoginResponse } from '../models/auth';
import { DEFAULT_PREFERENCES, isSavedPreferences, Preferences } from '../models/preferences';
import { ApplicationError } from '../utils/error-message';

const STORAGE_KEYS = {
  token: 'workshop_token',
  user: 'workshop_user',
  preferences: 'workshop_preferences'
};

@Injectable({ providedIn: 'root' })
export class SessionService {
  read(): LoginResponse | null {
    try {
      this.clearLegacyCredentials();
      const token = sessionStorage.getItem(STORAGE_KEYS.token);
      if (!token) {
        return null;
      }
      const user: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.user) || 'null');
      const session: unknown = { token, user };
      if (!isLoginResponse(session)) {
        throw new ApplicationError('storage');
      }
      return session;
    } catch {
      throw new ApplicationError('storage');
    }
  }

  save(session: LoginResponse, preferences: Preferences): void {
    try {
      this.clearLegacyCredentials();
      localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences));
      sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(session.user));
      sessionStorage.setItem(STORAGE_KEYS.token, session.token);
    } catch {
      this.clear();
      throw new ApplicationError('storage');
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.token);
      sessionStorage.removeItem(STORAGE_KEYS.user);
      this.clearLegacyCredentials();
    } catch {
      throw new ApplicationError('storage');
    }
  }

  preferences(): Preferences {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) || '{}');
      if (!isSavedPreferences(saved)) {
        throw new ApplicationError('preferences');
      }
      return {
        theme: saved.theme ?? DEFAULT_PREFERENCES.theme,
        showTips: saved.showTips ?? DEFAULT_PREFERENCES.showTips,
        compact: saved.compact ?? DEFAULT_PREFERENCES.compact
      };
    } catch {
      throw new ApplicationError('preferences');
    }
  }

  private clearLegacyCredentials(): void {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
  }
}
