import type { QuizData } from './types/spotify';

const API_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(code: string, status: number) { super(code); this.name = 'ApiError'; this.code = code; this.status = status; }
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include', ...options });
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new ApiError(body.error || `request_failed_${response.status}`, response.status); }
  return (response.status === 204 ? null : response.json()) as Promise<T>;
};

export const login = (): void => { window.location.href = `${API_URL}/api/auth/login`; };
export const getQuizData = (): Promise<QuizData> => request<QuizData>('/api/quiz-data');
export const logout = (): Promise<null> => request<null>('/api/auth/logout', { method: 'POST' });
export const saveQuizAttempt = (score: number, total: number): Promise<{ id: string }> => request('/api/quiz-attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score, total, quizVersion: 'v1' }) });
