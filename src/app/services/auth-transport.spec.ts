import '@angular/compiler';
import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { TasksService } from './tasks.service';
import { SessionService } from './session.service';

describe('Authentication and tasks with real Axios and a temporary loopback HTTP server', () => {
  const configuredUrl = environment.authUrl;
  const configuredTasksUrl = environment.tasksUrl;
  let server: Server | undefined;

  async function listen(): Promise<void> {
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server!.address();
    if (!address || typeof address === 'string') {
      throw new Error('The temporary test server has no TCP address');
    }
    environment.authUrl = `http://127.0.0.1:${address.port}/auth/login`;
    environment.tasksUrl = `http://127.0.0.1:${address.port}/api/tasks`;
  }

  afterEach(async () => {
    environment.authUrl = configuredUrl;
    environment.tasksUrl = configuredTasksUrl;
    vi.restoreAllMocks();
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    }
    server = undefined;
  });

  it('aborts a nonresponding login with the configured real 5000ms timeout', async () => {
    let receivedRequest = false;
    server = createServer((request) => {
      receivedRequest = request.method === 'POST' && request.url === '/auth/login';
      request.resume();
    });
    await listen();
    expect(environment.loginTimeout).toBe(5000);
    const started = Date.now();
    await expect(new AuthService().login('student', 'password')).rejects.toMatchObject({
      code: 'ECONNABORTED',
      config: { timeout: 5000 }
    });
    expect(receivedRequest).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(4900);
  }, 15000);

  it('rejects a connection when the backend is unavailable', async () => {
    server = createServer();
    await listen();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    await expect(new AuthService().login('student', 'password')).rejects.toMatchObject({
      code: 'ECONNREFUSED'
    });
  });

  it.each([401, 403, 500])('rejects an actual HTTP %s response', async (status) => {
    server = createServer((request, response) => {
      request.resume();
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: 'internal diagnostic' }));
    });
    await listen();
    await expect(new AuthService().login('student', 'password')).rejects.toMatchObject({
      response: { status }
    });
  });

  it.each([200, 201, 299])('preserves login JSON request and accepts valid HTTP %s', async (status) => {
    let method = '';
    let url = '';
    let headers: IncomingHttpHeaders = {};
    let body = '';
    server = createServer((request, response) => {
      method = request.method || '';
      url = request.url || '';
      headers = request.headers;
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => {
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ token: 'token', user: { username: 'student' } }));
      });
    });
    await listen();
    await expect(new AuthService().login(' student ', ' password ')).resolves.toEqual({
      token: 'token', user: { username: 'student' }
    });
    expect(method).toBe('POST');
    expect(url).toBe('/auth/login');
    expect(headers['content-type']).toBe('application/json');
    expect(headers['accept']).toBe('application/json, text/plain, */*');
    expect(headers['authorization']).toBeUndefined();
    expect(JSON.parse(body)).toEqual({
      username: ' student ', password: ' password ', client: 'angular-workshop'
    });
  });

  it('rejects HTTP 204 without a login response body', async () => {
    server = createServer((request, response) => {
      request.resume();
      response.writeHead(204);
      response.end();
    });
    await listen();
    await expect(new AuthService().login('student', 'password')).rejects.toThrow('respuesta inválida');
  });

  it.each([200, 299, 401, 403, 500, 204])('preserves GET authorization and handles HTTP %s', async (status) => {
    let url = '';
    let method = '';
    let body = '';
    let headers: IncomingHttpHeaders = {};
    server = createServer((request, response) => {
      url = request.url || '';
      method = request.method || '';
      headers = request.headers;
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => {
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(status === 204 ? undefined : JSON.stringify([]));
      });
    });
    await listen();
    const session = new SessionService();
    vi.spyOn(session, 'read').mockReturnValue({ token: 'contract-token', user: { username: 'student' } });
    const result = new TasksService(session).list({ owner: 'student' });
    if (status === 204) {
      await expect(result).rejects.toThrow('respuesta inválida');
    } else if (status >= 400) {
      await expect(result).rejects.toMatchObject({ response: { status } });
    } else {
      await expect(result).resolves.toEqual([]);
    }
    expect(method).toBe('GET');
    expect(url).toBe('/api/tasks?owner=student');
    expect(headers['authorization']).toBe('Bearer contract-token');
    expect(headers['accept']).toBe('application/json, text/plain, */*');
    expect(body).toBe('');
  });
});
