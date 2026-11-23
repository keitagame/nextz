import 'server-only';
import crypto from 'node:crypto';
import { db, transaction } from './db';
import { HttpError } from './http';
import { hashPassword, sha256 } from './auth';
import { escapeHtml, sendMail } from './mail';
import { rateLimit } from './ratelimit';

const TOKEN_TTL = 60 * 60 * 1000; // 1 時間

/**
 * パスワード再設定メールを送る。確認済みのメールアドレスを持つアカウントだけが対象。
 * アドレスが登録されているかどうかを外から調べられないよう、呼び出し側は結果にかかわらず同じ応答を返すこと。
 */
export async function sendPasswordResetEmail(email: string, origin: string) {
  await rateLimit(`pwreset-to:${email}`, 3, 60 * 60 * 1000, '再設定メールの送信回数が上限に達しました。しばらくしてからお試しください');
  const u = await db.get<{ id: number; username: string }>('SELECT id, username FROM users WHERE lower(email) = ? AND email_verified_at IS NOT NULL AND banned_at IS NULL', [email]);
  if (!u) return;

  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.run('DELETE FROM password_resets WHERE user_id = ?', [u.id]); // 古いリンクは無効にする
  await db.run('INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [sha256(token), u.id, now + TOKEN_TTL, now]);
  if (Math.random() < 0.02) await db.run('DELETE FROM password_resets WHERE expires_at < ?', [now]);

  const link = `${origin}/reset-password?token=${token}`;
  await sendMail({
    to: email,
    subject: '【Z】パスワードの再設定',
    text: `@${u.username} さん\n\nパスワード再設定のリクエストを受け付けました。次のリンクを開いて、新しいパスワードを設定してください（1時間有効）。\n\n${link}\n\n心当たりがない場合は、このメールを破棄してください（パスワードは変更されません）。`,
    html: `<p>@${escapeHtml(u.username)} さん</p><p>パスワード再設定のリクエストを受け付けました。次のボタンから、新しいパスワードを設定してください（1時間有効）。</p><p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#1d9bf0;color:#fff;border-radius:999px;text-decoration:none;font-weight:bold">パスワードを再設定する</a></p><p style="color:#666;font-size:12px">ボタンが開けない場合は次の URL をブラウザに貼り付けてください。<br>${link}</p><p style="color:#666;font-size:12px">心当たりがない場合は、このメールを破棄してください（パスワードは変更されません）。</p>`,
  });
}

/** リンクのトークンでパスワードを変更する。トークンは使い切り。変更後は、そのアカウントのすべてのログイン中セッションを無効にする */
export async function resetPassword(token: string, newPassword: string) {
  const hash = await hashPassword(newPassword);
  await transaction(async (tx) => {
    const row = await tx.get<{ user_id: number }>('DELETE FROM password_resets WHERE token_hash = ? AND expires_at > ? RETURNING user_id', [sha256(token), Date.now()]);
    if (!row) throw new HttpError(400, 'リンクの有効期限が切れているか、すでに使われています。もう一度再設定メールを送ってください');
    await tx.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id]);
    await tx.run('DELETE FROM password_resets WHERE user_id = ?', [row.user_id]);
    await tx.run('DELETE FROM sessions WHERE user_id = ?', [row.user_id]);
  });
}
