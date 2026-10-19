import '@angular/compiler';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES } from '../models/preferences';
import { SessionService } from './session.service';

describe('SessionService characterization', () => {
  let local: Storage;
  let tab: Storage;
  let service: SessionService;
  const session = { token: 'test-token', user: { username: 'student' } };

  function storage(): Storage {
    const values = new Map<string, string>();
    return {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
      key: (index: number) => Array.from(values.keys())[index] ?? null
    };
  }

  beforeEach(() => {
    local = storage();
    tab = storage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', tab);
    service = new SessionService();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('returns no session when no token is stored', () => {
    expect(service.read()).toBeNull();
  });

  it('persists token, user and preferences and survives a new service instance', () => {
    service.save(session, DEFAULT_PREFERENCES);
    expect(new SessionService().read()).toEqual(session);
    expect(service.preferences()).toEqual(DEFAULT_PREFERENCES);
    expect(local.getItem('workshop_token')).toBeNull();
    expect(local.getItem('workshop_user')).toBeNull();
    expect(tab.getItem('workshop_token')).toBe(session.token);
  });

  it('removes credentials and leaves preferences on logout', () => {
    service.save(session, DEFAULT_PREFERENCES);
    service.clear();
    expect(service.read()).toBeNull();
    expect(local.getItem('workshop_preferences')).not.toBeNull();
  });

  it.each(['{', 'null', '{}', '{"username":""}', '{"username":2}'])(
    'reports invalid stored user %s', (user) => {
      tab.setItem('workshop_token', 'test-token');
      tab.setItem('workshop_user', user);
      expect(() => service.read()).toThrow('No se pudo acceder a la sesión');
    }
  );

  it('reports unavailable session storage', () => {
    vi.mocked(tab.getItem).mockImplementation(() => { throw new Error('private detail'); });
    expect(() => service.read()).toThrow('No se pudo acceder a la sesión');
  });

  it('reports a failed write and rolls back credentials', () => {
    service.save(session, DEFAULT_PREFERENCES);
    vi.mocked(local.setItem).mockImplementationOnce(() => { throw new Error('quota'); });
    expect(() => service.save(session, DEFAULT_PREFERENCES)).toThrow('No se pudo acceder a la sesión');
    expect(service.read()).toBeNull();
  });

  it('reports a failed removal', () => {
    vi.mocked(tab.removeItem).mockImplementation(() => { throw new Error('blocked'); });
    expect(() => service.clear()).toThrow('No se pudo acceder a la sesión');
  });

  it('combines saved preferences with defaults', () => {
    local.setItem('workshop_preferences', '{"compact":true}');
    expect(service.preferences()).toEqual({ ...DEFAULT_PREFERENCES, compact: true });
  });

  it.each(['{', 'null', '[]', '{"theme":1}', '{"showTips":"yes"}', '{"compact":1}'])(
    'reports invalid preferences %s', (preferences) => {
      local.setItem('workshop_preferences', preferences);
      expect(() => service.preferences()).toThrow('No se pudieron cargar las preferencias');
    }
  );

  it('preserves explicit preference values', () => {
    local.setItem('workshop_preferences', '{"theme":"dark","showTips":false,"compact":true}');
    expect(service.preferences()).toEqual({ theme: 'dark', showTips: false, compact: true });
  });

  it('removes inherited credentials without migrating their token', () => {
    local.setItem('workshop_token', session.token);
    local.setItem('workshop_user', JSON.stringify(session.user));
    expect(service.read()).toBeNull();
    expect(local.getItem('workshop_token')).toBeNull();
    expect(local.getItem('workshop_user')).toBeNull();
    expect(tab.length).toBe(0);
  });

  it('does not reuse the session in a fresh empty tab store', () => {
    service.save(session, DEFAULT_PREFERENCES);
    vi.stubGlobal('sessionStorage', storage());
    expect(new SessionService().read()).toBeNull();
  });

  it('reports a failure removing legacy credentials', () => {
    vi.mocked(local.removeItem).mockImplementation(() => { throw new Error('blocked'); });
    expect(() => service.read()).toThrow('No se pudo acceder a la sesión');
  });

  it('rolls back a partially written session', () => {
    const write = vi.mocked(tab.setItem).getMockImplementation()!;
    vi.spyOn(tab, 'setItem').mockImplementation((key, value) => {
      if (key === 'workshop_token') {
        expect(tab.getItem('workshop_user')).toBe(JSON.stringify(session.user));
        throw new Error('quota');
      }
      write(key, value);
    });
    expect(() => service.save(session, DEFAULT_PREFERENCES)).toThrow('No se pudo acceder a la sesión');
    expect(tab.getItem('workshop_user')).toBeNull();
    expect(tab.getItem('workshop_token')).toBeNull();
  });

  it('reports a token without its user', () => {
    tab.setItem('workshop_token', session.token);
    expect(() => service.read()).toThrow('No se pudo acceder a la sesión');
  });

  it.each([
    { theme: '', showTips: false, compact: false },
    { theme: 'dark' },
    { compact: false },
    {}
  ])('preserves flat preferences and defaults without mutation: %j', (saved) => {
    const before = { ...DEFAULT_PREFERENCES };
    local.setItem('workshop_preferences', JSON.stringify(saved));
    const preferences = service.preferences();
    expect(preferences).toEqual({ ...DEFAULT_PREFERENCES, ...saved });
    service.save(session, preferences);
    expect(new SessionService().preferences()).toEqual(preferences);
    expect(DEFAULT_PREFERENCES).toEqual(before);
  });
});
