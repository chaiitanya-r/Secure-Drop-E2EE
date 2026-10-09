import { apiFetch } from './client';
import type { LoginResponse } from '../types/api';

export function loginRequest(email: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export function registerRequest(email: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, role: 'user' })
  });
}

export function fetchCurrentUser(token: string) {
  return apiFetch<{ id: string; email: string; role: 'admin' | 'user'; rsaPublicKey: string }>(
    '/api/auth/me',
    { method: 'GET' },
    token
  );
}


