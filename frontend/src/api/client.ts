import { notifications } from '@mantine/notifications';

const params = new URLSearchParams(location.search);
const bootstrap = params.get('token');
if (bootstrap !== null) {
  sessionStorage.setItem('token', bootstrap);
  params.delete('token');
  history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
}
export const token = sessionStorage.getItem('token') ?? '';
export class ApiError extends Error {}
export class NetworkError extends Error {}
export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`/api${path}`, { ...init, headers }).catch((error: unknown) => {
    if (error instanceof TypeError) throw new NetworkError(error.message);
    throw error;
  });
  if (!response.ok) {
    const error = await response.json() as { error: string; detail: string; traceback: string | null };
    notifications.show({ title: error.error, message: `${error.detail}${error.traceback ? `\n${error.traceback}` : ''}`, color: 'red', autoClose: false });
    throw new ApiError(error.detail);
  }
  return response;
}
export async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  return await (await request(path, init)).json() as T;
}
export function body(value: unknown): RequestInit { return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }; }
