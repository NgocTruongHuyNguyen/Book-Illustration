import type { Project } from '@book-studio/shared';
import type {User} from '@book-studio/shared/types/user';
import { API_BASE_URL } from './config.js';
import { getCurrentUserEmail } from './authStore.js';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type RunStepResponse =
  | { outcome: 'started'; project: Project }
  | { outcome: 'already-running'; project: Project };

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; requiresAuth?: boolean } = {}
): Promise<T> {
  const { method = 'GET', body, requiresAuth = true } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (requiresAuth) {
    const email = getCurrentUserEmail();
    if (!email) {
      throw new ApiError(401, 'Not signed in.');
    }
    headers['x-user-email'] = email;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, data.error ?? `Request failed: ${response.status}`);
  }

  return data as T;
}

export function signIn(email: string, name: string): Promise<{ user: User }> {
  return request('/auth/signin', { method: 'POST', body: { email, name }, requiresAuth: false });
}

export function createProject(title: string, bookText: string): Promise<{ project: Project }> {
  return request('/projects', { method: 'POST', body: { title, bookText } });
}

export function listProjects(): Promise<{ projects: Project[] }> {
  return request('/projects');
}

export function getProject(id: string): Promise<{ project: Project }> {
  return request(`/projects/${id}`);
}

export function runStep(id: string, style?: string): Promise<RunStepResponse> {
  return request(`/projects/${id}/steps/run`, {
    method: 'POST',
    body: style ? { style } : undefined,
  });
}

export function retryStep(id: string): Promise<{ project: Project }> {
  return request(`/projects/${id}/steps/retry`, { method: 'POST' });
}