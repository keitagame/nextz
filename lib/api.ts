export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

type Init = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit | null };

export async function api<T>(url: string, init: Init = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  let body = rest.body;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'ネットワークに接続できません');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const d = data as { error?: string; code?: string } | null;
    throw new ApiError(res.status, d?.error ?? 'エラーが発生しました', d?.code);
  }
  return data as T;
}

export async function uploadImage(file: File, opts: { emoji?: boolean; decoration?: boolean } = {}): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  if (opts.emoji) fd.append('kind', 'emoji');
  else if (opts.decoration) fd.append('kind', 'decoration');
  const r = await api<{ url: string }>('/api/upload', { method: 'POST', body: fd });
  return r.url;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'エラーが発生しました');
