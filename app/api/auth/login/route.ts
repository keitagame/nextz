import { open, readJson, str, HttpError, clientIp } from '@/lib/http';
import { createSession, hashPassword, isSecureRequest, verifyPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { getProfile } from '@/lib/users';

// ユーザーが存在しない場合も同じ計算量にしてタイミング差を減らす
let dummyHash: Promise<string> | null = null;

export const POST = open(async ({ req }) => {
  const body = await readJson(req);
  const username = str(body.username, 'ユーザー名', { min: 1, max: 15 }).replace(/^@/, '');
  const password = str(body.password, 'パスワード', { min: 1, max: 128, trim: false });
  await rateLimit(`login:${clientIp(req)}:${username.toLowerCase()}`, 10, 15 * 60 * 1000, 'ログイン試行回数が上限に達しました。15分後にお試しください');

  const row = await db.get<{ id: number; password_hash: string }>('SELECT id, password_hash FROM users WHERE lower(username) = lower(?)', [username]);
  dummyHash ??= hashPassword('dummy-password');
  const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash));
  if (!row || !ok) throw new HttpError(401, 'ユーザー名またはパスワードが正しくありません');

  await createSession(row.id, isSecureRequest(req));
  return { user: await getProfile(username, row.id) };
});
