import { isRecord } from './auth';

export interface TasksRequest {
  owner: string;
}

export interface Task {
  title: string;
  description?: string;
  status: string;
  priority?: string | number | null;
  owner?: string | null;
}

export interface VisibleTask extends Task {
  label: string;
}

export type TasksResponse = Task[];

export function isTask(value: unknown): value is Task {
  return isRecord(value) && typeof value['title'] === 'string' &&
    typeof value['status'] === 'string' &&
    (value['description'] === undefined || typeof value['description'] === 'string') &&
    (value['priority'] === undefined || value['priority'] === null ||
      typeof value['priority'] === 'string' || typeof value['priority'] === 'number') &&
    (value['owner'] === undefined || value['owner'] === null || typeof value['owner'] === 'string');
}

export function isTasksResponse(value: unknown): value is TasksResponse {
  return Array.isArray(value) && value.every(isTask);
}
