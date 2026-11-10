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

  const row = await db.get<{ id: number; password_hash: string; banned_at: number | null; ban_reason: string }>(
    'SELECT id, password_hash, banned_at, ban_reason FROM users WHERE lower(username) = lower(?)',
    [username],
  );
  dummyHash ??= hashPassword('dummy-password');
  const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash));
  if (!row || !ok) throw new HttpError(401, 'ユーザー名またはパスワードが正しくありません');

  // 凍結の理由は、パスワードが合っていた本人にだけ見せる（ユーザー名の存在確認に使われないように、判定はパスワード確認の後）
  if (row.banned_at) {
    const reason = row.ban_reason ? `理由：${row.ban_reason}` : '';
    throw new HttpError(403, `このアカウントは利用規約違反のため凍結されています。${reason}`.trim());
  }

  await createSession(row.id, isSecureRequest(req));
  return { user: await getProfile(username, row.id) };
});
