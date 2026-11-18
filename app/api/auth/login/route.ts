import { open, readJson, str, HttpError, clientIp } from '@/lib/http';
import { createSession, hashPassword, isSecureRequest, verifyPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { getProfile } from '@/lib/users';

// ユーザーが存在しない場合も同じ計算量にしてタイミング差を減らす
let dummyHash: Promise<string> | null = null;

/**
 * ログイン。
 *   メールアドレスを登録しているアカウント → メールアドレス + パスワードでのみログインできる（ユーザー名では不可）
 *   メール未登録の昔のアカウント           → これまでどおりユーザー名 + パスワード
 * メール未確認のアカウントは 403（code: email_unverified）。
 */
export const POST = open(async ({ req }) => {
  const body = await readJson(req);
  const ident = str(body.username, 'メールアドレスまたはユーザー名', { min: 1, max: 254 }).replace(/^@/, '');
  const password = str(body.password, 'パスワード', { min: 1, max: 128, trim: false });
  await rateLimit(`login:${clientIp(req)}:${ident.toLowerCase()}`, 10, 15 * 60 * 1000, 'ログイン試行回数が上限に達しました。15分後にお試しください');

  type Row = { id: number; username: string; password_hash: string; banned_at: number | null; ban_reason: string; email: string | null; email_verified_at: number | null };
  const COLS = 'id, username, password_hash, banned_at, ban_reason, email, email_verified_at';
  const byEmail = ident.includes('@');
  const row = await db.get<Row>(
    byEmail
      // 同じアドレスの未確認アカウントが他にあっても、確認済みの持ち主を優先する
      ? `SELECT ${COLS} FROM users WHERE lower(email) = lower(?) ORDER BY (email_verified_at IS NOT NULL) DESC, id LIMIT 1`
      : `SELECT ${COLS} FROM users WHERE lower(username) = lower(?)`,
    [ident],
  );
  dummyHash ??= hashPassword('dummy-password');
  const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash));
  if (!row || !ok) throw new HttpError(401, 'メールアドレス（またはユーザー名）かパスワードが正しくありません');

  // 凍結の理由は、パスワードが合っていた本人にだけ見せる（アカウントの存在確認に使われないように、判定はパスワード確認の後）
  if (row.banned_at) {
    const reason = row.ban_reason ? `理由：${row.ban_reason}` : '';
    throw new HttpError(403, `このアカウントは利用規約違反のため凍結されています。${reason}`.trim());
  }

  // メールアドレスを登録しているアカウントは、ユーザー名ではログインできない（パスワードが合っていた本人にだけ案内する）
  if (row.email && !byEmail) {
    throw new HttpError(403, 'このアカウントは、ユーザー名ではなく登録したメールアドレスでログインしてください', 'use_email');
  }
  if (row.email && !row.email_verified_at) {
    throw new HttpError(403, 'メールアドレスの確認が完了していません。確認メールのリンクを開いてください', 'email_unverified');
  }

  await createSession(row.id, isSecureRequest(req));
  return { user: await getProfile(row.username, row.id) };
});
