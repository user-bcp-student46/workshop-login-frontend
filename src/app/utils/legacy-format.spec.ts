import { describe, expect, it } from 'vitest';
import { formatTaskLabel } from './legacy-format';

describe('formatTaskLabel', () => {
  it('formats priority and owner', () => {
    expect(formatTaskLabel({ priority: 'high', owner: 'student' })).toBe('HIGH · STUDENT');
  });
  it.each([null, undefined])('formats absent task %s', (task) => {
    expect(formatTaskLabel(task)).toBe('SIN-DATOS');
  });
  it('preserves defaults and numeric priorities', () => {
    expect(formatTaskLabel({})).toBe('NORMAL · SIN-ASIGNAR');
    expect(formatTaskLabel({ priority: 2, owner: 'student' })).toBe('2 · STUDENT');
    expect(formatTaskLabel({ priority: 0, owner: '' })).toBe('NORMAL · SIN-ASIGNAR');
  });
});
