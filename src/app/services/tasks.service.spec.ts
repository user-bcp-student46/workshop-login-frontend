import '@angular/compiler';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service';
import { TasksService } from './tasks.service';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

describe('TasksService', () => {
  const session = new SessionService();
  const service = new TasksService(session);
  const task = { title: 'task', status: 'TODO' };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(session, 'read').mockReturnValue({ token: 'token', user: { username: 'student' } });
  });

  it('passes the exact URL and authorization and accepts optional fields', async () => {
    const tasks = [
      task,
      { ...task, priority: null, owner: null },
      { ...task, priority: 2, owner: 'student', description: 'description' },
      { ...task, priority: 'high' }
    ];
    vi.mocked(axios.get).mockResolvedValue({ data: tasks });
    await expect(service.list({ owner: 'student' })).resolves.toEqual(tasks);
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student',
      { headers: { Authorization: 'Bearer token' } });
  });

  it('accepts an empty task list', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    await expect(service.list({ owner: 'student' })).resolves.toEqual([]);
  });

  it.each([
    null, {}, [null], [{ status: 'TODO' }], [{ title: 'title' }],
    [{ ...task, description: 3 }], [{ ...task, priority: {} }], [{ ...task, owner: 5 }]
  ])('rejects malformed tasks %j', async (data) => {
    vi.mocked(axios.get).mockResolvedValue({ data });
    await expect(service.list({ owner: 'student' })).rejects.toThrow('respuesta inválida');
  });

  it('does not request tasks without a session', async () => {
    vi.spyOn(session, 'read').mockReturnValue(null);
    vi.mocked(axios.get).mockClear();
    await expect(service.list({ owner: 'student' })).rejects.toThrow('sesión');
    expect(axios.get).not.toHaveBeenCalled();
  });
});
