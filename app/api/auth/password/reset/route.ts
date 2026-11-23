import { open, readJson, str, clientIp } from '@/lib/http';
import { resetPassword } from '@/lib/password-reset';
import { rateLimit } from '@/lib/ratelimit';

/** 再設定リンクのトークンと新しいパスワードで、パスワードを変更する（ログインは別途行う） */
export const POST = open(async ({ req }) => {
  await rateLimit(`pwreset:${clientIp(req)}`, 20, 15 * 60 * 1000);
  const body = await readJson(req);
  const token = str(body.token, 'リンク', { min: 1, max: 100 });
  const password = str(body.password, '新しいパスワード', { min: 8, max: 128, trim: false });
  await resetPassword(token, password);
  return { ok: true };
});
