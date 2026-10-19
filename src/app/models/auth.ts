export interface LoginRequest {
  username: string;
  password: string;
  client: string;
}

export interface User {
  username: string;
  displayName?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUser(value: unknown): value is User {
  return isRecord(value) && typeof value['username'] === 'string' &&
    value['username'].trim() !== '' &&
    (value['displayName'] === undefined || typeof value['displayName'] === 'string');
}

export function isLoginResponse(value: unknown): value is LoginResponse {
  return isRecord(value) && typeof value['token'] === 'string' &&
    value['token'].trim() !== '' && isUser(value['user']);
}
