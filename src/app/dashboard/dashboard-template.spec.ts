// @vitest-environment jsdom
import '@angular/compiler';
import template from './dashboard.component.html?raw';
import styles from './dashboard.component.css?raw';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, NgZone, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Router } from '@angular/router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginResponse } from '../models/auth';
import { Task } from '../models/task';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';
import { ApplicationError } from '../utils/error-message';
import { DashboardComponent } from './dashboard.component';

@Component({ standalone: true, imports: [CommonModule], template })
class RenderedDashboard extends DashboardComponent {
  constructor() {
    super(inject(Router), inject(ChangeDetectorRef), inject(NgZone), inject(SessionService), inject(TasksService));
  }
}

describe('Dashboard rendered template', () => {
  const session: LoginResponse = {
    token: 'dom-token', user: { username: 'student', displayName: 'Student' }
  };
  const read = vi.fn<SessionService['read']>();
  const clear = vi.fn<SessionService['clear']>();
  const list = vi.fn<TasksService['list']>();
  const navigate = vi.fn<Router['navigate']>();
  let fixture: ComponentFixture<RenderedDashboard> | undefined;
  let pendingTasks: Promise<Task[]>;
  let resolveTasks: (tasks: Task[]) => void;
  let rejectTasks: (error: unknown) => void;

  beforeAll(async () => {
    await resolveComponentResources((url) => Promise.resolve(url.endsWith('.html') ? template : styles));
    TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
  });

  beforeEach(async () => {
    pendingTasks = new Promise<Task[]>((resolve, reject) => {
      resolveTasks = resolve;
      rejectTasks = reject;
    });
    read.mockReset().mockReturnValue(session);
    clear.mockReset();
    list.mockReset().mockReturnValue(pendingTasks);
    navigate.mockReset().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [RenderedDashboard],
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: SessionService, useValue: { read, clear } },
        { provide: TasksService, useValue: { list } }
      ]
    });
    await TestBed.compileComponents();
  });

  afterEach(async () => {
    resolveTasks([]);
    if (fixture) {
      await fixture.whenStable();
    }
    TestBed.resetTestingModule();
    fixture = undefined;
    vi.restoreAllMocks();
  });

  function render(): { host: HTMLElement; view: ComponentFixture<RenderedDashboard> } {
    fixture = TestBed.createComponent(RenderedDashboard);
    fixture.detectChanges();
    return { host: fixture.nativeElement, view: fixture };
  }

  async function completeTasks(tasks: Task[]): Promise<void> {
    resolveTasks(tasks);
    await pendingTasks;
    await fixture!.whenStable();
    fixture!.detectChanges();
  }

  it('renders loading, greeting, filtered cards, priority order and status labels', async () => {
    const { host } = render();
    expect(host.querySelector('.state-row')).not.toBeNull();
    expect(host.querySelectorAll('.task')).toHaveLength(0);
    expect(host.querySelector('.empty')).toBeNull();
    expect(list).toHaveBeenCalledExactlyOnceWith({ owner: 'student' });
    await completeTasks([
      { title: 'low', status: 'TODO', priority: 1, owner: 'student' },
      { title: 'hidden', status: 'ARCHIVED', priority: 3, owner: 'student' },
      { title: 'high', status: 'DONE', priority: 2, owner: 'student', description: 'description' }
    ]);
    expect(host.querySelector('h1')?.textContent).toBe('Hola, Student');
    const cards = [...host.querySelectorAll<HTMLElement>('.task')];
    expect(cards.map((card) => card.querySelector('h2')?.textContent)).toEqual(['high', 'low']);
    expect(cards.map((card) => card.querySelector('.task-meta')?.textContent)).toEqual([
      '2 · STUDENT', '1 · STUDENT'
    ]);
    expect(cards.map((card) => card.querySelector('.pill')?.textContent)).toEqual(['Completado', 'Por hacer']);
    expect(cards[0].querySelector('p')?.textContent).toBe('description');
    expect(host.querySelector('.state-row')).toBeNull();
    expect(host.querySelector('.error')).toBeNull();
    expect(host.querySelector('.empty')).toBeNull();
  });

  it.each([
    { name: 'empty list', tasks: [] },
    { name: 'only archived', tasks: [{ title: 'hidden', status: 'ARCHIVED' }] }
  ])('renders the empty state for $name', async ({ tasks }) => {
    const { host } = render();
    await completeTasks(tasks);
    expect(host.querySelector('.empty')?.textContent).toBe('No hay tareas para mostrar todavía.');
    expect(host.querySelectorAll('.task')).toHaveLength(0);
    expect(host.querySelector('.state-row')).toBeNull();
    expect(host.querySelector('.error')).toBeNull();
  });

  it.each([
    { name: '401', error: { response: { status: 401, data: { detail: 'private diagnostic' } } } },
    { name: '403', error: { response: { status: 403 } } },
    { name: 'network', error: new Error('private network diagnostic') },
    { name: 'transport timeout', error: { code: 'ECONNABORTED' } },
    { name: 'invalid response', error: new ApplicationError('invalid-response') }
  ])('renders controlled $name errors without cards, auto logout or redirect', async ({ error }) => {
    const { host } = render();
    rejectTasks(error);
    await expect(pendingTasks).rejects.toBe(error);
    await fixture!.whenStable();
    fixture!.detectChanges();
    const expected = error instanceof ApplicationError
      ? 'El servicio devolvió una respuesta inválida.'
      : 'No se pudo cargar el dashboard. Intente de nuevo.';
    expect(host.querySelector('.error')?.textContent).toBe(expected);
    expect(host.querySelector('.state-row')).toBeNull();
    expect(host.querySelector('.grid')).toBeNull();
    expect(host.querySelectorAll('.task')).toHaveLength(0);
    expect(clear).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it.each(['success', 'storage failure', 'navigation failure'])('handles logout click: %s', async (outcome) => {
    const { host, view } = render();
    await completeTasks([{ title: 'visible', status: 'TODO' }]);
    if (outcome === 'storage failure') {
      clear.mockImplementation(() => { throw new ApplicationError('storage'); });
    } else if (outcome === 'navigation failure') {
      navigate.mockRejectedValue(new Error('private routing diagnostic'));
    }
    const logout = vi.spyOn(view.componentInstance, 'logout');
    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(logout).toHaveBeenCalledTimes(1);
    await logout.mock.results[0].value;
    await view.whenStable();
    view.detectChanges();
    expect(clear).toHaveBeenCalledTimes(1);
    if (outcome === 'storage failure') {
      expect(navigate).not.toHaveBeenCalled();
      expect(host.querySelector('.error')?.textContent).toBe(
        'No se pudo acceder a la sesión. Inicie sesión de nuevo.');
    } else {
      expect(navigate).toHaveBeenCalledExactlyOnceWith(['/login']);
      expect(clear.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
      if (outcome === 'navigation failure') {
        expect(host.querySelector('.error')?.textContent).toBe(
          'No se pudo cerrar la sesión. Intente de nuevo.');
      } else {
        expect(host.querySelector('.error')).toBeNull();
      }
    }
  });
});
