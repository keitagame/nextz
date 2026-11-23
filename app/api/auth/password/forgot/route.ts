import { open, readJson, clientIp } from '@/lib/http';
import { parseEmail } from '@/lib/contact';
import { sendPasswordResetEmail } from '@/lib/password-reset';
import { rateLimit } from '@/lib/ratelimit';
import { baseUrl } from '@/lib/url';

/** メールアドレスにパスワード再設定リンクを送る。登録の有無にかかわらず同じ応答を返す（アドレスの存在確認に使わせない） */
export const POST = open(async ({ req }) => {
  await rateLimit(`pwforgot:${clientIp(req)}`, 10, 60 * 60 * 1000, '送信回数が上限に達しました。しばらくしてからお試しください');
  const body = await readJson(req);
  const email = parseEmail(body.email);
  await sendPasswordResetEmail(email, baseUrl(req));
  return { ok: true };
});
