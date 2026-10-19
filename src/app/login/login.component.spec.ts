import '@angular/compiler';
import { ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

describe('LoginComponent characterization', () => {
  const navigate = vi.fn().mockResolvedValue(true);
  const markForCheck = vi.fn();
  const router = Router.prototype;
  const cdr: ChangeDetectorRef = {
    markForCheck,
    detach: vi.fn(),
    detectChanges: vi.fn(),
    checkNoChanges: vi.fn(),
    reattach: vi.fn()
  };
  let storage: Map<string, string>;
  let tab: Map<string, string>;
  let component: LoginComponent;

  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockImplementation(navigate);
    storage = new Map();
    tab = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    });
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => tab.get(key) ?? null,
      setItem: (key: string, value: string) => tab.set(key, value),
      removeItem: (key: string) => tab.delete(key)
    });
    component = new LoginComponent(
      router, new AuthService(), new SessionService(), cdr
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([null, undefined, '', '   '])('rejects empty username %s', async (username) => {
    component.username = username;
    component.password = 'Workshop123!';
    await component.login();
    expect(axios.post).not.toHaveBeenCalled();
    expect(component.message).toContain('Ingrese un usuario.');
  });

  it.each([null, undefined, '', '   '])('rejects empty password %s', async (password) => {
    component.username = 'student';
    component.password = password;
    await component.login();
    expect(axios.post).not.toHaveBeenCalled();
    expect(component.message).toContain('Ingrese una contraseña.');
  });

  it('preserves the exact HTTP request, session and navigation', async () => {
    const user = { username: 'student', displayName: 'Student' };
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user } });
    component.username = 'student';
    component.password = 'Workshop123!';
    await component.login();
    expect(axios.post).toHaveBeenCalledWith('http://localhost:8080/auth/login',
      { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
      { timeout: 5000 });
    expect(tab.get('workshop_token')).toBe('test-token');
    expect(JSON.parse(tab.get('workshop_user')!)).toEqual(user);
    expect(storage.has('workshop_token')).toBe(false);
    expect(storage.has('workshop_user')).toBe(false);
    expect(JSON.parse(storage.get('workshop_preferences')!)).toEqual({
      theme: 'light', showTips: true, compact: false
    });
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.busy).toBe(false);
  });

  it('does not navigate when the backend omits the token', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    component.username = 'student';
    component.password = 'password';
    await component.login();
    expect(component.message).toContain('El backend respondió sin token.');
    expect(navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
  });

  it('reports an HTTP failure and resets busy', async () => {
    vi.mocked(axios.post).mockRejectedValue({ response: { data: { message: 'Denied' } } });
    component.username = 'student';
    component.password = 'password';
    await component.login();
    expect(component.message).toContain('No se pudo autenticar');
    expect(component.message).not.toContain('Denied');
    expect(navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
    expect(markForCheck).toHaveBeenCalled();
  });

  it('merges saved preferences with defaults', () => {
    storage.set('workshop_preferences', JSON.stringify({ compact: true }));
    component = new LoginComponent(
      router, new AuthService(), new SessionService(), cdr
    );
    expect(component.preferences).toEqual({ theme: 'light', showTips: true, compact: true });
  });

  it('reports malformed preferences and retains defaults', () => {
    storage.set('workshop_preferences', '{');
    component = new LoginComponent(
      router, new AuthService(), new SessionService(), cdr
    );
    expect(component.preferences).toEqual({ theme: 'light', showTips: true, compact: false });
    expect(component.message).toBe('No se pudieron cargar las preferencias guardadas.');
  });

  it('does not navigate or report success after a failed session write', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { token: 'token', user: { username: 'student' } }
    });
    vi.stubGlobal('sessionStorage', {
      setItem: () => { throw new Error('quota'); },
      removeItem: () => {}
    });
    component.username = 'student';
    component.password = 'password';
    await component.login();
    expect(component.message).toContain('No se pudo acceder a la sesión');
    expect(component.busy).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['backend unavailable', { code: 'ECONNREFUSED' }],
    ['network/CORS failure', { code: 'ERR_NETWORK' }],
    ['timeout', { code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' }],
    ['unauthorized', { response: { status: 401, data: { message: 'internal' } } }],
    ['forbidden', { response: { status: 403 } }],
    ['server error', { response: { status: 500 } }]
  ])('shows a safe error for %s without retries or replacing an existing session', async (_, error) => {
    tab.set('workshop_token', 'previous-token');
    tab.set('workshop_user', JSON.stringify({ username: 'previous' }));
    vi.mocked(axios.post).mockRejectedValue(error);
    component.username = 'student';
    component.password = 'password';
    await component.login();
    expect(component.message).toBe('No se pudo autenticar. Verifique sus credenciales e intente de nuevo.');
    expect(component.busy).toBe(false);
    expect(markForCheck).toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith('http://localhost:8080/auth/login',
      { username: 'student', password: 'password', client: 'angular-workshop' }, { timeout: 5000 });
    expect(tab.get('workshop_token')).toBe('previous-token');
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([{}, { token: '' }, { token: null }, { token: false }, { token: 0 }])(
    'rejects missing/falsy token %j at the presentation boundary', async (data) => {
      vi.mocked(axios.post).mockResolvedValue({ data });
      component.username = 'student';
      component.password = 'password';
      await component.login();
      expect(component.message).toBe('El backend respondió sin token.');
      expect(component.busy).toBe(false);
      expect(tab.size).toBe(0);
      expect(navigate).not.toHaveBeenCalled();
    }
  );

  it.each([null, [], 'not JSON', { token: true }, { token: '   ' }, { token: 'token', user: {} }])(
    'reports unexpected response %j without creating a session', async (data) => {
      vi.mocked(axios.post).mockResolvedValue({ data });
      component.username = 'student';
      component.password = 'password';
      await component.login();
      expect(component.message).toBe('El servicio devolvió una respuesta inválida.');
      expect(component.busy).toBe(false);
      expect(tab.size).toBe(0);
      expect(navigate).not.toHaveBeenCalled();
    }
  );

  it('preserves original whitespace in nonempty credentials', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { token: 'token', user: { username: 'student' } }
    });
    component.username = ' student ';
    component.password = ' password ';
    await component.login();
    expect(axios.post).toHaveBeenCalledWith('http://localhost:8080/auth/login',
      { username: ' student ', password: ' password ', client: 'angular-workshop' }, { timeout: 5000 });
  });

  it('reports navigation rejection after saving the session', async () => {
    navigate.mockRejectedValueOnce(new Error('navigation failed'));
    vi.mocked(axios.post).mockResolvedValue({
      data: { token: 'token', user: { username: 'student' } }
    });
    component.username = 'student';
    component.password = 'password';
    await component.login();
    expect(component.message).toBe('No se pudo autenticar. Verifique sus credenciales e intente de nuevo.');
    expect(component.busy).toBe(false);
    expect(tab.get('workshop_token')).toBe('token');
  });

  it.each(['{"compact":1}', '{'])('reports invalid preferences %s and clears the message on retry', async (saved) => {
    storage.set('workshop_preferences', saved);
    component = new LoginComponent(
      router, new AuthService(), new SessionService(), cdr
    );
    expect(component.message).toBe('No se pudieron cargar las preferencias guardadas.');
    await component.login();
    expect(component.message).toContain('Ingrese un usuario.');
    expect(component.preferences).toEqual({ theme: 'light', showTips: true, compact: false });
  });

  it('reports inaccessible preferences without hiding the failure', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); }
    });
    component = new LoginComponent(
      router, new AuthService(), new SessionService(), cdr
    );
    expect(component.message).toBe('No se pudieron cargar las preferencias guardadas.');
  });

  it('reports failure deleting inherited credentials and does not navigate', async () => {
    vi.stubGlobal('localStorage', {
      removeItem: () => { throw new Error('blocked'); }
    });
    vi.mocked(axios.post).mockResolvedValue({
      data: { token: 'token', user: { username: 'student' } }
    });
    component.username = 'student';
    component.password = 'password';
    await component.login();
    expect(component.message).toContain('No se pudo acceder a la sesión');
    expect(component.busy).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
