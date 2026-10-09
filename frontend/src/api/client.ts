const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function parseResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Request failed');
    }
    return body;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Request failed');
  }
  return {} as T;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return parseResponse<T>(res);
}

export async function apiFetchBinary(
  path: string,
  token?: string | null
): Promise<ArrayBuffer> {
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Download failed');
  }
  return res.arrayBuffer();
}

export function buildDownloadUrl(path: string) {
  return `${API_BASE}${path}`;
}


