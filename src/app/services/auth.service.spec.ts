import '@angular/compiler';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

describe('AuthService', () => {
  const service = new AuthService();
  beforeEach(() => vi.clearAllMocks());

  it('returns a valid response without changing the HTTP contract', async () => {
    const response = { token: 'token', user: { username: 'student', displayName: 'Student' } };
    vi.mocked(axios.post).mockResolvedValue({ data: response });
    await expect(service.login('student', 'password')).resolves.toEqual(response);
    expect(axios.post).toHaveBeenCalledWith('http://localhost:8080/auth/login',
      { username: 'student', password: 'password', client: 'angular-workshop' }, { timeout: 5000 });
  });

  it.each([
    null, [], 'invalid', { token: 3 }, { token: ' ' },
    { token: 'token', user: null }, { token: 'token', user: {} },
    { token: 'token', user: { username: 3 } }, { token: 'token', user: { username: '' } },
    { token: 'token', user: { username: 'student', displayName: 1 } }
  ])('rejects malformed login data %j', async (data) => {
    vi.mocked(axios.post).mockResolvedValue({ data });
    await expect(service.login('student', 'password')).rejects.toThrow('respuesta inválida');
  });

  it.each([{}, { token: '' }])('reports missing token %j', async (data) => {
    vi.mocked(axios.post).mockResolvedValue({ data });
    await expect(service.login('student', 'password')).rejects.toThrow('sin token');
  });

  it('supports a user without a display name', async () => {
    const response = { token: 'token', user: { username: 'student' } };
    vi.mocked(axios.post).mockResolvedValue({ data: response });
    await expect(service.login('student', 'password')).resolves.toEqual(response);
  });

  it('propagates transport failures for presentation handling', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('timeout'));
    await expect(service.login('student', 'password')).rejects.toThrow('timeout');
  });
});
