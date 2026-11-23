import 'server-only';
import { db } from './db';
import { HttpError } from './http';

/**
 * DB ベースのスライディングウィンドウ式レート制限。
 * Vercel のようなサーバーレス（インスタンスが都度入れ替わる）でも正しく動くよう、状態は DB に持つ。
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  message = 'リクエストが多すぎます。しばらくしてからお試しください',
) {
  const now = Date.now();
  const r = await db.get<{ c: number }>('SELECT COUNT(*) AS c FROM rate_limits WHERE bucket = ? AND hit_at > ?', [key, now - windowMs]);
  if ((r?.c ?? 0) >= max) throw new HttpError(429, message);
  await db.run('INSERT INTO rate_limits (bucket, hit_at) VALUES (?, ?)', [key, now]);
  // 古い記録を低頻度で掃除（最長ウィンドウは 1 時間）
  if (Math.random() < 0.02) await db.run('DELETE FROM rate_limits WHERE hit_at < ?', [now - 60 * 60 * 1000]);
}
