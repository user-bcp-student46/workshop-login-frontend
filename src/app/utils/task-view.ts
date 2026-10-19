import { Task, VisibleTask } from '../models/task';
import { formatTaskLabel } from './legacy-format';

export function visibleTasks(tasks: Task[]): VisibleTask[] {
  return tasks
    .filter((task) => task.status !== 'ARCHIVED')
    .map((task) => ({ ...task, label: formatTaskLabel(task) }))
    .sort((first, second) => {
      if (first.priority === undefined || second.priority === undefined) {
        return 1;
      }
      // Preserve JavaScript's original null-to-zero relational comparison.
      return (first.priority ?? 0) > (second.priority ?? 0) ? -1 : 1;
    });
}
