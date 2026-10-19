import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models/auth';
import { Task, VisibleTask } from '../models/task';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';
import { errorMessage } from '../utils/error-message';
import { visibleTasks } from '../utils/task-view';

const STATUS_LABELS: Record<string, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Completado',
  RESUELTO: 'Resuelto',
  COMPLETED: 'Completado'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  tasks: Task[] = [];
  visibleTasks: VisibleTask[] = [];
  user: User = { username: '' };
  loading = true;
  error = '';

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private session: SessionService,
    private taskService: TasksService
  ) {}

  statusLabel(status: string): string {
    return STATUS_LABELS[(status || '').toUpperCase()] || status;
  }

  async ngOnInit(): Promise<void> {
    try {
      const session = this.session.read();
      if (!session) {
        await this.router.navigate(['/login']);
        return;
      }
      this.user = session.user;
      const tasks = await this.taskService.list({ owner: this.user.username });
      this.zone.run(() => {
        this.tasks = tasks;
        this.visibleTasks = visibleTasks(tasks);
        this.loading = false;
        this.cdr.detectChanges();
      });
    } catch (error: unknown) {
      this.zone.run(() => {
        this.error = errorMessage(error, 'tasks');
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async logout(): Promise<void> {
    try {
      this.session.clear();
      await this.router.navigate(['/login']);
    } catch (error: unknown) {
      this.zone.run(() => {
        this.error = errorMessage(error, 'logout');
        this.cdr.detectChanges();
      });
    }
  }
}
