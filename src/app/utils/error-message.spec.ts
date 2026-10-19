import { describe, expect, it } from 'vitest';
import { ApplicationError, errorMessage } from './error-message';

describe('errorMessage', () => {
  it('shows controlled application errors', () => {
    expect(errorMessage(new ApplicationError('storage'), 'login')).toContain('sesión');
    expect(errorMessage(new ApplicationError('invalid-response'), 'tasks')).toContain('respuesta inválida');
    expect(errorMessage(new ApplicationError('preferences'), 'login')).toContain('preferencias');
    expect(errorMessage(new ApplicationError('missing-token'), 'login')).toContain('sin token');
  });

  it.each(['login', 'tasks', 'logout'] as const)('does not leak details for %s', (context) => {
    const message = errorMessage(new Error('secret internal detail'), context);
    expect(message).not.toContain('secret internal detail');
    expect(message).toContain('No se pudo');
    expect(errorMessage(null, context)).toBe(message);
  });
});
