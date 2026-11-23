import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
import { sha256 } from './auth';

/**
 * ログインの途中状態（OAuth 新規登録の入力待ち）。
 * 本体は DB（auth_pending）にあり、ブラウザには推測できないトークンを httpOnly Cookie で持たせる。
 * 「ログイン済み」ではないので、これだけでは API は使えない。
 */
const COOKIE = 'nextz_pending';

export type PendingKind = 'oauth_signup';

export async function setPending(kind: PendingKind, userId: number | null, data: Record<string, unknown>, ttlMs: number, secure: boolean) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const jar = await cookies();
  const old = jar.get(COOKIE)?.value;
  if (old) await db.run('DELETE FROM auth_pending WHERE token_hash = ?', [sha256(old)]);
  await db.run('INSERT INTO auth_pending (token_hash, kind, user_id, data, expires_at) VALUES (?, ?, ?, ?, ?)', [sha256(token), kind, userId, JSON.stringify(data), now + ttlMs]);
  if (Math.random() < 0.02) await db.run('DELETE FROM auth_pending WHERE expires_at < ?', [now]);
  jar.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: Math.floor(ttlMs / 1000) });
}

export interface Pending {
  kind: PendingKind;
  userId: number | null;
  data: Record<string, unknown>;
}

export async function getPending(kind?: PendingKind): Promise<Pending | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await db.get<{ kind: PendingKind; user_id: number | null; data: string }>('SELECT kind, user_id, data FROM auth_pending WHERE token_hash = ? AND expires_at > ?', [sha256(token), Date.now()]);
  if (!row || (kind && row.kind !== kind)) return null;
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(row.data);
  } catch {}
  return { kind: row.kind, userId: row.user_id, data };
}

export async function clearPending() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.run('DELETE FROM auth_pending WHERE token_hash = ?', [sha256(token)]);
  jar.delete(COOKIE);
}
