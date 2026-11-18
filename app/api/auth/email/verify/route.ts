import { open, readJson, str, clientIp } from '@/lib/http';
import { consumeEmailToken } from '@/lib/email-verify';
import { rateLimit } from '@/lib/ratelimit';

/** 確認メールのリンクのトークンでメールアドレスを確認済みにする（ログインは別途行う） */
export const POST = open(async ({ req }) => {
  await rateLimit(`mailverify:${clientIp(req)}`, 20, 15 * 60 * 1000);
  const body = await readJson(req);
  const token = str(body.token, 'リンク', { min: 1, max: 100 });
  const { email } = await consumeEmailToken(token);
  return { ok: true, email };
});
