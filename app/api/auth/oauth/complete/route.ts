import { open, readJson, str, HttpError, clientIp } from '@/lib/http';
import { createSession, isSecureRequest, unusablePasswordHash } from '@/lib/auth';
import { db, transaction } from '@/lib/db';
import { clearPending, getPending } from '@/lib/pending';
import { rateLimit } from '@/lib/ratelimit';
import { RESERVED_USERNAMES, USERNAME_RE } from '@/lib/text';
import { TERMS_VERSION } from '@/lib/terms';
import { getProfile } from '@/lib/users';

/**
 * OAuth での新規登録の仕上げ。ユーザー名・表示名・利用規約への同意（サーバー側でも必須）を受け取ってアカウントを作る。
 * パスワードは持たない（あとで設定画面から設定できる）。外部サービスで確認済みのメールアドレスは確認済みとして登録する。
 */
export const POST = open(async ({ req }) => {
  await rateLimit(`oauth-complete:${clientIp(req)}`, 15, 60 * 60 * 1000);
  const pending = await getPending('oauth_signup');
  if (!pending) throw new HttpError(401, '有効期限が切れました。もう一度ログインからやり直してください', 'no_pending');
  const body = await readJson(req);
  const username = str(body.username, 'ユーザー名', { min: 3, max: 15 });
  const name = str(body.name, '表示名', { min: 1, max: 30 });
  if (body.agreeTerms !== true) throw new HttpError(400, 'アカウントを作成するには利用規約への同意が必要です');
  if (body.termsVersion !== TERMS_VERSION) throw new HttpError(400, '利用規約が更新されました。ページを再読み込みして、もう一度内容をご確認ください');
  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'ユーザー名は半角英数字とアンダースコアのみ使用できます（3〜15文字）');
  if (RESERVED_USERNAMES.has(username.toLowerCase())) throw new HttpError(400, 'このユーザー名は使用できません');
  if (await db.get('SELECT 1 FROM users WHERE lower(username) = lower(?)', [username])) throw new HttpError(409, 'このユーザー名はすでに使われています');

  const d = pending.data as { provider?: string; sub?: string; email?: string | null };
  if (!d.provider || !d.sub) throw new HttpError(400, 'ログイン情報が正しくありません。もう一度お試しください');
  let email = d.email ?? null;
  if (email && (await db.get('SELECT 1 FROM users WHERE lower(email) = ? AND email_verified_at IS NOT NULL', [email]))) email = null; // 取り合いになったらメールは登録しない

  let id: number;
  try {
    const now = Date.now();
    id = await transaction(async (tx) => {
      const { lastId } = await tx.run(
        'INSERT INTO users (username, display_name, password_hash, email, email_verified_at, created_at, terms_version, terms_agreed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
        [username, name, unusablePasswordHash(), email, email ? now : null, now, TERMS_VERSION, now],
      );
      await tx.run('INSERT INTO oauth_accounts (provider, provider_user_id, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)', [d.provider, d.sub, lastId, d.email ?? null, now]);
      return lastId;
    });
  } catch (e) {
    const c = e as { code?: string; constraint?: string };
    if (c.code === '23505') {
      if (c.constraint?.includes('username')) throw new HttpError(409, 'このユーザー名はすでに使われています');
      throw new HttpError(409, 'この外部アカウントはすでに登録されています。ログインからやり直してください');
    }
    throw e;
  }
  await clearPending();
  await createSession(id, isSecureRequest(req));
  return { user: await getProfile(username, id) };
});
