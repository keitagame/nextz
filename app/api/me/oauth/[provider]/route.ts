import { humanOnly, HttpError } from '@/lib/http';
import { hasUsablePassword } from '@/lib/auth';
import { db } from '@/lib/db';

/** 連携の解除。ログインする手段が 1 つも無くなってしまう場合（パスワードも他の連携も無い）は解除できない */
export const DELETE = humanOnly(async ({ viewer, params }) => {
  const provider = params.provider;
  const u = await db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [viewer.idNum]);
  const rows = await db.all<{ provider: string }>('SELECT provider FROM oauth_accounts WHERE user_id = ?', [viewer.idNum]);
  if (!rows.some((r) => r.provider === provider)) throw new HttpError(404, '連携されていません');
  const others = rows.filter((r) => r.provider !== provider).length;
  if (!hasUsablePassword(u?.password_hash) && others === 0) {
    throw new HttpError(400, 'ログインできる方法がなくなるため解除できません。先にパスワードを設定してください');
  }
  await db.run('DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?', [viewer.idNum, provider]);
  return { ok: true };
});
