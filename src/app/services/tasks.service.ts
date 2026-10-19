import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { isTasksResponse, TasksRequest, TasksResponse } from '../models/task';
import { ApplicationError } from '../utils/error-message';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class TasksService {
  constructor(private session: SessionService) {}

  async list(request: TasksRequest): Promise<TasksResponse> {
    const session = this.session.read();
    if (!session) {
      throw new ApplicationError('storage');
    }
    const response = await axios.get<unknown>(environment.tasksUrl + '?owner=' + request.owner, {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    if (!isTasksResponse(response.data)) {
      throw new ApplicationError('invalid-response');
    }
    return response.data;
  }
}
