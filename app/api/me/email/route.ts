import { humanOnly, readJson, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { parseEmail } from '@/lib/contact';
import { sendVerificationEmail } from '@/lib/email-verify';
import { baseUrl } from '@/lib/url';

/**
 * メールアドレスの登録・変更・確認メールの再送。
 * 新しいアドレスに確認リンクを送り、リンクを開くまでは今の状態のまま（email_tokens に「確認待ちのアドレス」を持つ）。
 * email を省略すると、未確認の今のアドレスに確認メールを送り直す。
 */
export const POST = humanOnly(async ({ req, viewer }) => {
  const body = await readJson(req);
  const cur = await db.get<{ email: string | null; email_verified_at: number | null }>('SELECT email, email_verified_at FROM users WHERE id = ?', [viewer.idNum]);
  let email: string;
  if (body.email === undefined) {
    if (!cur?.email || cur.email_verified_at) throw new HttpError(400, '確認が必要なメールアドレスがありません');
    email = cur.email;
  } else {
    email = parseEmail(body.email);
    if (cur?.email_verified_at && cur.email?.toLowerCase() === email) throw new HttpError(400, 'すでに登録・確認済みのメールアドレスです');
    if (await db.get('SELECT 1 FROM users WHERE lower(email) = ? AND email_verified_at IS NOT NULL AND id <> ?', [email, viewer.idNum])) {
      throw new HttpError(409, 'このメールアドレスはすでに別のアカウントで使われています');
    }
    // 確認リンクを開くまで users.email は変えない（打ち間違えたアドレスのせいで、ログインできなくなるのを防ぐ）
  }
  await sendVerificationEmail({ userId: viewer.idNum, username: viewer.username, email, origin: baseUrl(req) });
  return { ok: true, email };
});
