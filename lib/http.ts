import 'server-only';
import { NextRequest } from 'next/server';
import { getViewer, type Viewer } from './auth';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface Ctx<V> {
  req: NextRequest;
  params: Record<string, string>;
  viewer: V;
}

type RouteCtx = { params: Promise<Record<string, string>> };

function sameOrigin(req: NextRequest) {
  // ブラウザが付与する Sec-Fetch-Site は JS から偽装できないため最優先で信頼する
  const site = req.headers.get('sec-fetch-site');
  if (site === 'same-origin' || site === 'none') return true;
  if (site === 'cross-site' || site === 'same-site') return false;

  // 古いブラウザや非ブラウザ用のフォールバック：Origin が自分のホスト名のどれかと一致すればOK
  const origin = req.headers.get('origin');
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const candidates = [
    req.headers.get('host'),
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim(),
    req.nextUrl.host,
  ].filter(Boolean);
  return candidates.includes(originHost);
}

function wrap<V>(needAuth: boolean, fn: (c: Ctx<V>) => Promise<unknown>) {
  return async (req: NextRequest, routeCtx: RouteCtx): Promise<Response> => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
        throw new HttpError(403, '不正なリクエストです');
      }
      // cookies() は実行時 API。Cache Components 下でもリクエスト時に必ず実行されるようにする
      const viewer = await getViewer();
      if (needAuth && !viewer) throw new HttpError(401, 'ログインが必要です');
      const params = (await routeCtx?.params) ?? {};
      const result = await fn({ req, params, viewer: viewer as V });
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
      if (e instanceof HttpError) {
        return Response.json({ error: e.message }, { status: e.status, headers: { 'Cache-Control': 'no-store' } });
      }
      // Next.js 内部の制御用例外（プリレンダー中断など）は握りつぶさずそのまま投げる
      if (e && typeof e === 'object' && ('digest' in e || /During prerendering/.test(String((e as Error).message)))) throw e;
      console.error('[api error]', req.method, req.nextUrl.pathname, e);
      return Response.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
  };
}

/** ログイン必須のエンドポイント */
export const authed = (fn: (c: Ctx<Viewer>) => Promise<unknown>) => wrap<Viewer>(true, fn);
/** ログイン不要（viewer は null の可能性あり） */
export const open = (fn: (c: Ctx<Viewer | null>) => Promise<unknown>) => wrap<Viewer | null>(false, fn);

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* fallthrough */
  }
  throw new HttpError(400, 'リクエストの形式が正しくありません');
}

export function str(
  v: unknown,
  label: string,
  { min = 0, max = 1000, trim = true }: { min?: number; max?: number; trim?: boolean } = {},
): string {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') throw new HttpError(400, `${label}が正しくありません`);
  const s = trim ? v.trim() : v;
  const len = Array.from(s).length;
  if (len < min) throw new HttpError(400, min === 1 ? `${label}を入力してください` : `${label}は${min}文字以上で入力してください`);
  if (len > max) throw new HttpError(400, `${label}は${max}文字以内で入力してください`);
  return s;
}

export function intId(v: unknown, label = 'ID'): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${label}が正しくありません`);
  return n;
}

export function cursorOf(req: NextRequest, fallback: number): number {
  const c = req.nextUrl.searchParams.get('cursor');
  if (!c) return fallback;
  const n = Number(c);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}
