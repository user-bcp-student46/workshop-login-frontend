// @vitest-environment jsdom
import '@angular/compiler';
import template from './login.component.html?raw';
import styles from './login.component.css?raw';
import { ChangeDetectorRef, Component, inject, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Router } from '@angular/router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { DEFAULT_PREFERENCES } from '../models/preferences';
import { LoginResponse } from '../models/auth';
import { LoginComponent } from './login.component';

@Component({ standalone: true, imports: [CommonModule, FormsModule], template })
class RenderedLogin extends LoginComponent {
  constructor() {
    super(inject(Router), inject(AuthService), inject(SessionService), inject(ChangeDetectorRef));
  }
}

describe('Login rendered template', () => {
  const authenticate = vi.fn<AuthService['login']>();
  const save = vi.fn<SessionService['save']>();
  const navigate = vi.fn<Router['navigate']>();

  function enterCredentials(host: HTMLElement, username: string, password: string): void {
    for (const [name, value] of [['username', username], ['password', password]]) {
      const input = host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  beforeAll(async () => {
    await resolveComponentResources((url) => Promise.resolve(url.endsWith('.html') ? template : styles));
    TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
  });
  beforeEach(async () => {
    authenticate.mockReset().mockRejectedValue(new Error('internal'));
    save.mockReset();
    navigate.mockReset().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [RenderedLogin],
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: AuthService, useValue: { login: authenticate } },
        { provide: SessionService, useValue: { preferences: () => ({ ...DEFAULT_PREFERENCES }), save } }
      ]
    });
    await TestBed.compileComponents();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('validates empty inputs through clicks without calling authentication', async () => {
    const fixture = TestBed.createComponent(RenderedLogin);
    fixture.detectChanges();
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    const button = host.querySelector<HTMLButtonElement>('button')!;
    button.click();
    fixture.detectChanges();
    expect(host.querySelector('.message strong')?.textContent).toBe('Ingrese un usuario.');
    enterCredentials(host, 'student', '');
    await fixture.whenStable();
    button.click();
    fixture.detectChanges();
    expect(host.querySelector('.message strong')?.textContent).toBe('Ingrese una contraseña.');
    expect(authenticate).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
  });

  it.each(['success', 'error'])('handles input, pending state and %s through a real click', async (outcome) => {
    const response: LoginResponse = { token: 'dom-token', user: { username: 'student' } };
    let resolve!: (session: LoginResponse) => void;
    let reject!: (error: Error) => void;
    authenticate.mockReturnValue(new Promise<LoginResponse>((accept, decline) => {
      resolve = accept;
      reject = decline;
    }));
    const fixture = TestBed.createComponent(RenderedLogin);
    fixture.detectChanges();
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    enterCredentials(host, ' student ', ' password ');
    await fixture.whenStable();
    const attempt = vi.spyOn(fixture.componentInstance, 'login');
    const button = host.querySelector<HTMLButtonElement>('button')!;
    button.click();
    try {
      fixture.detectChanges();
      expect(attempt).toHaveBeenCalledTimes(1);
      expect(authenticate).toHaveBeenCalledExactlyOnceWith(' student ', ' password ');
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain('Ingresando...');
      expect(host.querySelector('.spinner')).not.toBeNull();
      expect(save).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      if (outcome === 'success') {
        resolve(response);
      } else {
        reject(new Error('private backend diagnostic'));
      }
      await attempt.mock.results[0].value;
      await fixture.whenStable();
      fixture.detectChanges();
      expect(button.disabled).toBe(false);
      expect(button.textContent?.trim()).toBe('Ingresar');
      expect(host.querySelector('.spinner')).toBeNull();
      if (outcome === 'success') {
        expect(save).toHaveBeenCalledExactlyOnceWith(response, DEFAULT_PREFERENCES);
        expect(navigate).toHaveBeenCalledExactlyOnceWith(['/dashboard']);
        expect(save.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
        expect(host.querySelector('.message')).toBeNull();
      } else {
        expect(host.querySelector('.message')?.textContent).toBe(
          'No se pudo autenticar. Verifique sus credenciales e intente de nuevo.');
        expect(save).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
      }
    } finally {
      resolve(response);
      await attempt.mock.results[0]?.value;
      await fixture.whenStable();
    }
  });

  it('shows normal errors and finishes the busy state', async () => {
    const fixture = TestBed.createComponent(RenderedLogin);
    fixture.componentInstance.username = 'student';
    fixture.componentInstance.password = 'password';
    await fixture.componentInstance.login();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.message')?.textContent).toBe(
      'No se pudo autenticar. Verifique sus credenciales e intente de nuevo.');
    expect(host.querySelector('.message strong')).toBeNull();
    expect(host.querySelector('button')?.disabled).toBe(false);
  });

  it('renders markup literally without creating elements', () => {
    const fixture = TestBed.createComponent(RenderedLogin);
    fixture.componentInstance.message = '<em>mensaje de prueba</em>';
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.message')?.textContent).toBe('<em>mensaje de prueba</em>');
    expect(host.querySelector('.message em')).toBeNull();
  });

  it('resets validation formatting before displaying an HTTP error', async () => {
    const fixture = TestBed.createComponent(RenderedLogin);
    await fixture.componentInstance.login();
    fixture.detectChanges();
    expect(fixture.componentInstance.validationMessage).toBe(true);
    fixture.componentInstance.username = 'student';
    fixture.componentInstance.password = 'password';
    await fixture.componentInstance.login();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance.validationMessage).toBe(false);
    expect(host.querySelector('.message strong')).toBeNull();
    expect(host.querySelector('.message')?.textContent).toBe(
      'No se pudo autenticar. Verifique sus credenciales e intente de nuevo.');
  });
});
