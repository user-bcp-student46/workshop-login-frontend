import '@angular/compiler';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardComponent } from './dashboard.component';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

describe('DashboardComponent characterization', () => {
  const navigate = vi.fn().mockResolvedValue(true);
  const detectChanges = vi.fn();
  const router = Router.prototype;
  const cdr: ChangeDetectorRef = {
    detectChanges,
    markForCheck: vi.fn(),
    detach: vi.fn(),
    checkNoChanges: vi.fn(),
    reattach: vi.fn()
  };
  let storage: Map<string, string>;
  let preferences: Map<string, string>;
  let component: DashboardComponent;

  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockImplementation(navigate);
    storage = new Map([
      ['workshop_token', 'test-token'],
      ['workshop_user', JSON.stringify({ username: 'student' })]
    ]);
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key)
    });
    preferences = new Map([['workshop_preferences', '{}']]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => preferences.get(key) ?? null,
      removeItem: (key: string) => preferences.delete(key)
    });
    const session = new SessionService();
    component = new DashboardComponent(
      router,
      cdr,
      { run: (callback: () => void) => callback() } as NgZone,
      session,
      new TasksService(session)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('redirects without calling HTTP if there is no token', async () => {
    storage.delete('workshop_token');
    await component.ngOnInit();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('preserves request, filtering, label and descending priority comparison', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [
      { title: 'low', status: 'TODO', priority: 1, owner: 'student' },
      { title: 'hidden', status: 'ARCHIVED', priority: 3, owner: 'student' },
      { title: 'high', status: 'DONE', priority: 2, owner: 'student' }
    ] });
    await component.ngOnInit();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student',
      { headers: { Authorization: 'Bearer test-token' } });
    expect(component.visibleTasks.map((task) => task.title)).toEqual(['high', 'low']);
    expect(component.visibleTasks.map((task) => task.label)).toEqual(['2 · STUDENT', '1 · STUDENT']);
    expect(component.loading).toBe(false);
    expect(detectChanges).toHaveBeenCalled();
  });

  it('shows errors and resets loading', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network failure'));
    await component.ngOnInit();
    expect(component.error).toBeTruthy();
    expect(component.loading).toBe(false);
    expect(detectChanges).toHaveBeenCalled();
  });

  it('clears authentication but preserves preferences on logout without HTTP', async () => {
    await component.logout();
    expect(storage.has('workshop_token')).toBe(false);
    expect(storage.has('workshop_user')).toBe(false);
    expect(preferences.has('workshop_preferences')).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('preserves status labels and unknown status', () => {
    expect(component.statusLabel('todo')).toBe('Por hacer');
    expect(component.statusLabel('custom')).toBe('custom');
    expect(component.statusLabel('')).toBe('');
  });

  it('reports a failed logout without pretending that it succeeded', async () => {
    vi.stubGlobal('sessionStorage', {
      removeItem: () => { throw new Error('blocked'); }
    });
    await component.logout();
    expect(component.error).toContain('No se pudo acceder a la sesión');
    expect(navigate).not.toHaveBeenCalled();
    expect(detectChanges).toHaveBeenCalled();
  });

  it('reports malformed session data before attempting HTTP', async () => {
    storage.set('workshop_user', '{');
    await component.ngOnInit();
    expect(component.error).toContain('No se pudo acceder a la sesión');
    expect(component.loading).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid token / unauthorized', { response: { status: 401, data: { detail: 'internal' } } }],
    ['expired token / forbidden', { response: { status: 403 } }],
    ['backend unavailable', { code: 'ECONNREFUSED' }],
    ['network/CORS failure', { code: 'ERR_NETWORK' }],
    ['transport timeout', { code: 'ECONNABORTED' }],
    ['server error', { response: { status: 500 } }]
  ])('reports %s and preserves the session without retry or redirect', async (_, error) => {
    vi.mocked(axios.get).mockRejectedValue(error);
    await component.ngOnInit();
    expect(component.error).toBe('No se pudo cargar el dashboard. Intente de nuevo.');
    expect(component.loading).toBe(false);
    expect(component.visibleTasks).toEqual([]);
    expect(detectChanges).toHaveBeenCalled();
    expect(storage.get('workshop_token')).toBe('test-token');
    expect(navigate).not.toHaveBeenCalled();
    expect(axios.get).toHaveBeenCalledTimes(1);
    await component.logout();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it.each([null, {}, 'invalid JSON', [null], [{ title: 'task', status: 2 }]].map((data) => ({ data })))(
    'reports unexpected tasks $data instead of presenting an empty success', async ({ data }) => {
      vi.mocked(axios.get).mockResolvedValue({ data });
      await component.ngOnInit();
      expect(component.error).toBe('El servicio devolvió una respuesta inválida.');
      expect(component.loading).toBe(false);
      expect(component.visibleTasks).toEqual([]);
      expect(navigate).not.toHaveBeenCalled();
    }
  );

  it.each([[], [{ title: 'archived', status: 'ARCHIVED' }]].map((data) => ({ data })))(
    'finishes successfully with no visible tasks $data', async ({ data }) => {
      vi.mocked(axios.get).mockResolvedValue({ data });
      await component.ngOnInit();
      expect(component.error).toBe('');
      expect(component.loading).toBe(false);
      expect(component.visibleTasks).toEqual([]);
    }
  );

  it('reports a blank token without requesting tasks', async () => {
    storage.set('workshop_token', '   ');
    await component.ngOnInit();
    expect(component.error).toContain('No se pudo acceder a la sesión');
    expect(component.loading).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it.each(['getItem', 'removeItem'])('reports a storage %s failure before HTTP', async (method) => {
    const fail = () => { throw new Error('blocked'); };
    if (method === 'getItem') {
      vi.stubGlobal('sessionStorage', { getItem: fail });
    } else {
      vi.stubGlobal('localStorage', { removeItem: fail });
    }
    await component.ngOnInit();
    expect(component.error).toContain('No se pudo acceder a la sesión');
    expect(component.loading).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('reports a session disappearing between component and service reads', async () => {
    let tokenReads = 0;
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => key === 'workshop_token'
        ? (++tokenReads === 1 ? 'test-token' : null)
        : storage.get(key) ?? null
    });
    await component.ngOnInit();
    expect(component.error).toContain('No se pudo acceder a la sesión');
    expect(component.loading).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not configure a task timeout and stays loading until the transport settles', async () => {
    let finish!: (response: { data: [] }) => void;
    vi.mocked(axios.get).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = component.ngOnInit();
    expect(component.loading).toBe(true);
    expect(component.error).toBe('');
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student',
      { headers: { Authorization: 'Bearer ' + 'test-token' } });
    finish({ data: [] });
    await pending;
    expect(component.loading).toBe(false);
    expect(component.error).toBe('');
  });

  it('reports rejected logout navigation after clearing credentials', async () => {
    navigate.mockRejectedValueOnce(new Error('navigation failed'));
    await component.logout();
    expect(component.error).toBe('No se pudo cerrar la sesión. Intente de nuevo.');
    expect(storage.has('workshop_token')).toBe(false);
    expect(storage.has('workshop_user')).toBe(false);
    expect(preferences.has('workshop_preferences')).toBe(true);
    expect(detectChanges).toHaveBeenCalled();
  });

  it('reports rejected navigation when there is no token without requesting tasks', async () => {
    storage.delete('workshop_token');
    navigate.mockRejectedValueOnce(new Error('navigation failed'));
    await component.ngOnInit();
    expect(component.error).toBe('No se pudo cargar el dashboard. Intente de nuevo.');
    expect(component.loading).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
  });
});
