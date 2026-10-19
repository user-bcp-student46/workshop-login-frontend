import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { isLoginResponse, isRecord, LoginRequest, LoginResponse } from '../models/auth';
import { ApplicationError } from '../utils/error-message';

@Injectable({ providedIn: 'root' })
export class AuthService {
  async login(username: string, password: string): Promise<LoginResponse> {
    const request: LoginRequest = { username, password, client: environment.client };
    const response = await axios.post<unknown>(environment.authUrl, request, {
      timeout: environment.loginTimeout
    });
    if (isRecord(response.data) && !response.data['token']) {
      throw new ApplicationError('missing-token');
    }
    if (!isLoginResponse(response.data)) {
      throw new ApplicationError('invalid-response');
    }
    return response.data;
  }
}
