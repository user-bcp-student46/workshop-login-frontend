import '@angular/compiler';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { AuthService } from './services/auth.service';
import { SessionService } from './services/session.service';
import { TasksService } from './services/tasks.service';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

describe('Login to tasks to logout integration with simulated HTTP', () => {
  const navigate = vi.fn().mockResolvedValue(true);
  const markForCheck = vi.fn();
  const detectChanges = vi.fn();
  const router = Router.prototype;
  const cdr: ChangeDetectorRef = {
    markForCheck,
    detectChanges,
    detach: vi.fn(),
    checkNoChanges: vi.fn(),
    reattach: vi.fn()
  };
  let tab: Map<string, string>;
  let local: Map<string, string>;
  let login: LoginComponent;
  let dashboard: DashboardComponent;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(router, 'navigate').mockImplementation(navigate);
    tab = new Map();
    local = new Map();
    for (const [name, values] of [['sessionStorage', tab], ['localStorage', local]] as const) {
      vi.stubGlobal(name, {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key)
      });
    }
    const session = new SessionService();
    login = new LoginComponent(router, new AuthService(), session, cdr);
    dashboard = new DashboardComponent(router, cdr,
      { run: (callback: () => void) => callback() } as NgZone, session, new TasksService(session));
    login.username = 'student';
    login.password = 'password';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads tasks with the token obtained by login and clears the session on logout', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { token: 'flow-token', user: { username: 'student', displayName: 'Student' } }
    });
    vi.mocked(axios.get).mockResolvedValue({ data: [
      { title: 'Visible', status: 'TODO', priority: 2, owner: 'student' },
      { title: 'Hidden', status: 'ARCHIVED', priority: 3 }
    ] });
    await login.login();
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(login.busy).toBe(false);
    expect(tab.get('workshop_token')).toBe('flow-token');
    await dashboard.ngOnInit();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student',
      { headers: { Authorization: 'Bearer ' + 'flow-token' } });
    expect(dashboard.user.displayName).toBe('Student');
    expect(dashboard.visibleTasks.map((task) => task.title)).toEqual(['Visible']);
    expect(dashboard.loading).toBe(false);
    expect(dashboard.error).toBe('');
    await dashboard.logout();
    expect(tab.has('workshop_token')).toBe(false);
    expect(tab.has('workshop_user')).toBe(false);
    expect(local.has('workshop_preferences')).toBe(true);
    expect(navigate).toHaveBeenLastCalledWith(['/login']);
  });

  it('accepts a syntactically valid token but reports its rejection by tasks without auto logout', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { token: 'invalid-for-backend', user: { username: 'student' } }
    });
    vi.mocked(axios.get).mockRejectedValue({ response: { status: 401 } });
    await login.login();
    expect(login.message).toBe('');
    await dashboard.ngOnInit();
    expect(dashboard.error).toBe('No se pudo cargar el dashboard. Intente de nuevo.');
    expect(dashboard.loading).toBe(false);
    expect(tab.get('workshop_token')).toBe('invalid-for-backend');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenLastCalledWith(['/dashboard']);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
