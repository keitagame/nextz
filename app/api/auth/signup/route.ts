import { open, readJson, str, HttpError, clientIp } from '@/lib/http';
import { hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { RESERVED_USERNAMES, USERNAME_RE } from '@/lib/text';
import { TERMS_VERSION } from '@/lib/terms';
import { parseEmail } from '@/lib/contact';
import { sendVerificationEmail } from '@/lib/email-verify';
import { baseUrl } from '@/lib/url';

/**
 * アカウント作成。メールアドレスが必須で、作成直後はログインしない（確認メールのリンクを開くまでログイン不可）。
 * 確認メールが送れなかったときもアカウントは作られているので、ログイン画面の「確認メールを再送」から送り直せる。
 */
export const POST = open(async ({ req }) => {
  await rateLimit(`signup:${clientIp(req)}`, 10, 60 * 60 * 1000, 'アカウント作成の回数が上限に達しました。しばらくしてからお試しください');
  const body = await readJson(req);
  const username = str(body.username, 'ユーザー名', { min: 3, max: 15 });
  const name = str(body.name, '表示名', { min: 1, max: 30 });
  const email = parseEmail(body.email);
  const password = str(body.password, 'パスワード', { min: 8, max: 128, trim: false });

  // 利用規約への同意はサーバー側でも必須にする（画面を経由しない API 直叩きでも、同意なしでは作成できない）
  if (body.agreeTerms !== true) throw new HttpError(400, 'アカウントを作成するには利用規約への同意が必要です');
  if (body.termsVersion !== TERMS_VERSION) throw new HttpError(400, '利用規約が更新されました。ページを再読み込みして、もう一度内容をご確認ください');

  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'ユーザー名は半角英数字とアンダースコアのみ使用できます（3〜15文字）');
  if (RESERVED_USERNAMES.has(username.toLowerCase())) throw new HttpError(400, 'このユーザー名は使用できません');

  if (await db.get('SELECT 1 FROM users WHERE lower(username) = lower(?)', [username])) {
    throw new HttpError(409, 'このユーザー名はすでに使われています');
  }
  if (await db.get('SELECT 1 FROM users WHERE lower(email) = ? AND email_verified_at IS NOT NULL', [email])) {
    throw new HttpError(409, 'このメールアドレスはすでに使われています');
  }
  const hash = await hashPassword(password);
  let id: number;
  try {
    const now = Date.now();
    ({ lastId: id } = await db.run(
      'INSERT INTO users (username, display_name, password_hash, email, created_at, terms_version, terms_agreed_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [username, name, hash, email, now, TERMS_VERSION, now],
    ));
  } catch {
    throw new HttpError(409, 'このユーザー名はすでに使われています');
  }

  let sent = true;
  try {
    await sendVerificationEmail({ userId: id, username, email, origin: baseUrl(req) });
  } catch (e) {
    console.error('[signup] 確認メールの送信に失敗', e);
    sent = false;
  }
  return { verifyEmail: true, email, sent };
});
