import { open, readJson, str, HttpError, clientIp } from '@/lib/http';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email-verify';
import { rateLimit } from '@/lib/ratelimit';
import { baseUrl } from '@/lib/url';

let dummyHash: Promise<string> | null = null;

/** 確認メールの再送（未ログインで使うので、メールアドレス（またはユーザー名）とパスワードで本人確認する） */
export const POST = open(async ({ req }) => {
  const body = await readJson(req);
  const username = str(body.username, 'メールアドレスまたはユーザー名', { min: 1, max: 254 }).replace(/^@/, '');
  const password = str(body.password, 'パスワード', { min: 1, max: 128, trim: false });
  await rateLimit(`resend:${clientIp(req)}:${username.toLowerCase()}`, 5, 15 * 60 * 1000, '再送の回数が上限に達しました。しばらくしてからお試しください');

  const row = await db.get<{ id: number; username: string; password_hash: string; email: string | null; email_verified_at: number | null; banned_at: number | null }>(
    username.includes('@')
      ? 'SELECT id, username, password_hash, email, email_verified_at, banned_at FROM users WHERE lower(email) = lower(?) ORDER BY (email_verified_at IS NOT NULL) DESC, id LIMIT 1'
      : 'SELECT id, username, password_hash, email, email_verified_at, banned_at FROM users WHERE lower(username) = lower(?)',
    [username],
  );
  dummyHash ??= hashPassword('dummy-password');
  const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash));
  if (!row || !ok) throw new HttpError(401, 'メールアドレス（またはユーザー名）かパスワードが正しくありません');
  if (row.banned_at) throw new HttpError(403, 'このアカウントは利用できません');
  if (!row.email || row.email_verified_at) throw new HttpError(400, 'このアカウントは確認の必要がありません');

  await sendVerificationEmail({ userId: row.id, username: row.username, email: row.email, origin: baseUrl(req) });
  return { ok: true, email: row.email };
});
