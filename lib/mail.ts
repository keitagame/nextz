import 'server-only';
import { HttpError } from './http';

/**
 * メール送信（Resend の HTTP API）。環境変数:
 *   RESEND_API_KEY  Resend の API キー
 *   MAIL_FROM       送信元（例: Z <noreply@example.com>。Resend で認証済みのドメインにすること）
 * 別のサービス（SES・SendGrid など）を使うときは、この関数の中身だけ差し替えればよい。
 * 開発中（NODE_ENV !== production）に RESEND_API_KEY が無いときは、送らずにコンソールへ出力する。
 */
export async function sendMail({ to, subject, text, html }: { to: string; subject: string; text: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[mail:dev] to=${to}\nsubject=${subject}\n${text}\n`);
      return;
    }
    console.error('[mail] RESEND_API_KEY / MAIL_FROM が未設定です');
    throw new HttpError(503, 'メールを送信できません（サーバーの設定が完了していません）');
  }
  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error('[mail] 送信に失敗', e);
    throw new HttpError(502, 'メールの送信に失敗しました。しばらくしてからお試しください');
  }
  if (!res.ok) {
    console.error('[mail] Resend エラー', res.status, await res.text().catch(() => ''));
    throw new HttpError(502, 'メールの送信に失敗しました。しばらくしてからお試しください');
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
