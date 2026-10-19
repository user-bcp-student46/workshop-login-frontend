import { describe, expect, it } from 'vitest';
import { Task } from '../models/task';
import { visibleTasks } from './task-view';

describe('visibleTasks', () => {
  it('filters and labels tasks without mutating the response', () => {
    const tasks: Task[] = [
      { title: 'low', status: 'TODO', priority: 1 },
      { title: 'archived', status: 'ARCHIVED' },
      { title: 'high', status: 'DONE', priority: 3, owner: 'student' },
      { title: 'middle', status: 'TODO', priority: 2 }
    ];
    const before = structuredClone(tasks);
    expect(visibleTasks(tasks).map((task) => task.title)).toEqual(['high', 'middle', 'low']);
    expect(visibleTasks(tasks)[0].label).toBe('3 · STUDENT');
    expect(tasks).toEqual(before);
  });

  it('preserves string comparison and equal priority order', () => {
    expect(visibleTasks([
      { title: 'first', status: 'TODO', priority: 'high' },
      { title: 'second', status: 'TODO', priority: 'high' },
      { title: 'third', status: 'TODO', priority: 'low' }
    ]).map((task) => task.title)).toEqual(['third', 'first', 'second']);
    expect(visibleTasks([])).toEqual([]);
  });

  it('preserves comparison for absent and null priorities', () => {
    expect(visibleTasks([
      { title: 'undefined', status: 'TODO' },
      { title: 'null', status: 'TODO', priority: null }
    ]).map((task) => task.title)).toEqual(['undefined', 'null']);
    expect(visibleTasks([
      { title: 'null', status: 'TODO', priority: null },
      { title: 'undefined', status: 'TODO' }
    ]).map((task) => task.title)).toEqual(['null', 'undefined']);
    expect(visibleTasks([
      { title: 'null', status: 'TODO', priority: null },
      { title: 'zero', status: 'TODO', priority: 0 }
    ]).map((task) => task.title)).toEqual(['null', 'zero']);
    expect(visibleTasks([
      { title: 'zero', status: 'TODO', priority: 0 },
      { title: 'null', status: 'TODO', priority: null }
    ]).map((task) => task.title)).toEqual(['zero', 'null']);
  });
});
