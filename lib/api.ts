export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? 'エラーが発生しました');
  return data as T;
}

export async function uploadImage(file: File, opts: { emoji?: boolean } = {}): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  if (opts.emoji) fd.append('kind', 'emoji');
  const r = await api<{ url: string }>('/api/upload', { method: 'POST', body: fd });
  return r.url;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'エラーが発生しました');
