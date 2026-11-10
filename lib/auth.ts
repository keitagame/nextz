import 'server-only';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db';
import { toUser, type UserRow, USER_COLS } from './users';
import type { User } from '@/types/post';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const COOKIE = 'nextz_session';
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

export type Viewer = User & { idNum: number };

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, hashHex] = stored.split(':');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSession(userId: number, secure: boolean) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [sha256(token), userId, now + SESSION_TTL]);
  // 期限切れセッションを掃除（毎回ではなく低頻度で）
  if (Math.random() < 0.02) await db.run('DELETE FROM sessions WHERE expires_at < ?', [now]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
  jar.delete(COOKIE);
}

export async function getViewer(): Promise<Viewer | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await db.get<UserRow>(
    `SELECT ${USER_COLS} FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.banned_at IS NULL`,
    [sha256(token), Date.now()],
  );
  if (!row) return null;
  return { ...toUser(row), idNum: row.id };
}

/** ボット API トークン。`nzb_` + 256bit のランダム値。DB には SHA-256 ハッシュしか保存しない */
export const BOT_TOKEN_PREFIX = 'nzb_';

export function generateBotToken() {
  const token = BOT_TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  return { token, hash: sha256(token), prefix: token.slice(0, 8) };
}

/** Bearer トークンからボットを特定する。無効なら null */
export async function getBotViewer(token: string): Promise<Viewer | null> {
  if (!token.startsWith(BOT_TOKEN_PREFIX) || token.length > 100) return null;
  const now = Date.now();
  const row = await db.get<UserRow>(
    // ボット自身、またはその所有者が凍結されているときはトークンを無効にする（解除すれば元に戻る）
    `SELECT ${USER_COLS} FROM bots b JOIN users u ON u.id = b.user_id
     WHERE b.token_hash = ? AND u.banned_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM users o WHERE o.id = b.owner_id AND o.banned_at IS NOT NULL)`,
    [sha256(token)],
  );
  if (!row) return null;
  // 最終使用日時は 1 分に 1 回だけ更新する
  await db.run('UPDATE bots SET last_used_at = ? WHERE user_id = ? AND (last_used_at IS NULL OR last_used_at < ?)', [now, row.id, now - 60_000]);
  return { ...toUser(row), idNum: row.id };
}

export function isSecureRequest(req: Request): boolean {
  return new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}
