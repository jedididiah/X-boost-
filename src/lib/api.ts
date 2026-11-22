import { auth } from './firebase';

export async function authorizedFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    data = {} as T;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
