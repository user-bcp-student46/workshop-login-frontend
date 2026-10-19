import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DEFAULT_PREFERENCES, Preferences } from '../models/preferences';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { errorMessage } from '../utils/error-message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username: string | null | undefined = '';
  password: string | null | undefined = '';
  busy = false;
  message = '';
  validationMessage = false;
  preferences: Preferences = { ...DEFAULT_PREFERENCES };

  constructor(
    private router: Router,
    private auth: AuthService,
    private session: SessionService,
    private cdr: ChangeDetectorRef
  ) {
    try {
      this.preferences = this.session.preferences();
    } catch (error: unknown) {
      this.message = errorMessage(error, 'login');
    }
  }

  async login(): Promise<void> {
    this.message = '';
    this.validationMessage = false;
    if (!this.username?.trim()) {
      this.message = 'Ingrese un usuario.';
      this.validationMessage = true;
      return;
    }
    if (!this.password?.trim()) {
      this.message = 'Ingrese una contraseña.';
      this.validationMessage = true;
      return;
    }
    this.busy = true;
    try {
      const session = await this.auth.login(this.username, this.password);
      this.session.save(session, this.preferences);
      await this.router.navigate(['/dashboard']);
    } catch (error: unknown) {
      this.message = errorMessage(error, 'login');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
