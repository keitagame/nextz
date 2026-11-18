import 'server-only';
import crypto from 'node:crypto';
import { db, transaction } from './db';
import { HttpError } from './http';
import { rateLimit } from './ratelimit';
import { sha256 } from './auth';
import { escapeHtml, sendMail } from './mail';

const TOKEN_TTL = 24 * 60 * 60 * 1000;

/** メール確認リンクを送る。リンクは 24 時間・1 回だけ有効で、DB には SHA-256 ハッシュだけを保存する */
export async function sendVerificationEmail(opts: { userId: number; username: string; email: string; origin: string }) {
  const { userId, username, email, origin } = opts;
  await rateLimit(`mailv:${userId}`, 3, 10 * 60 * 1000, '確認メールの送信回数が上限に達しました。10分ほど待ってからお試しください');
  await rateLimit(`mailv-to:${email}`, 5, 60 * 60 * 1000, 'このアドレスへの送信回数が上限に達しました。しばらくしてからお試しください');

  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.run('DELETE FROM email_tokens WHERE user_id = ?', [userId]); // 古いリンクは無効にする
  await db.run('INSERT INTO email_tokens (token_hash, user_id, email, expires_at, created_at) VALUES (?, ?, ?, ?, ?)', [sha256(token), userId, email, now + TOKEN_TTL, now]);
  if (Math.random() < 0.02) await db.run('DELETE FROM email_tokens WHERE expires_at < ?', [now]);

  const link = `${origin}/verify-email?token=${token}`;
  await sendMail({
    to: email,
    subject: '【Z】メールアドレスの確認',
    text: `@${username} さん\n\nZ のメールアドレス確認です。次のリンクを開いて、画面のボタンを押してください（24時間有効）。\n\n${link}\n\n心当たりがない場合は、このメールを破棄してください。`,
    html: `<p>@${escapeHtml(username)} さん</p><p>Z のメールアドレス確認です。次のボタンから確認を完了してください（24時間有効）。</p><p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#1d9bf0;color:#fff;border-radius:999px;text-decoration:none;font-weight:bold">メールアドレスを確認する</a></p><p style="color:#666;font-size:12px">ボタンが開けない場合は次の URL をブラウザに貼り付けてください。<br>${link}</p><p style="color:#666;font-size:12px">心当たりがない場合は、このメールを破棄してください。</p>`,
  });
}

/** リンクのトークンを使って、メールアドレスを確認済みにする。トークンはここで使い切る */
export async function consumeEmailToken(token: string): Promise<{ userId: number; email: string }> {
  if (!token || token.length > 100) throw new HttpError(400, 'リンクが正しくありません');
  try {
    return await transaction(async (tx) => {
      const row = await tx.get<{ user_id: number; email: string }>('DELETE FROM email_tokens WHERE token_hash = ? AND expires_at > ? RETURNING user_id, email', [sha256(token), Date.now()]);
      if (!row) throw new HttpError(400, 'リンクの有効期限が切れているか、すでに使われています。もう一度確認メールを送ってください');
      await tx.run('UPDATE users SET email = ?, email_verified_at = ? WHERE id = ?', [row.email, Date.now(), row.user_id]);
      return { userId: row.user_id, email: row.email };
    });
  } catch (e) {
    // 確認済みのメールアドレスは 1 アカウントだけ（部分ユニークインデックス）。取り合いになったら後から確認した側が弾かれる
    if ((e as { code?: string }).code === '23505') throw new HttpError(409, 'このメールアドレスは別のアカウントで使われています');
    throw e;
  }
}
