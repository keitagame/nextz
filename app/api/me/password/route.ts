import { humanOnly, readJson, str, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { hasUsablePassword, hashPassword, verifyPassword } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';

/** パスワードの変更。OAuth で作ったアカウント（まだパスワードが無い）は、現在のパスワード無しで新しく設定できる */
export const POST = humanOnly(async ({ req, viewer }) => {
  await rateLimit(`pw:${viewer.idNum}`, 5, 15 * 60 * 1000);
  const body = await readJson(req);
  const next = str(body.next, '新しいパスワード', { min: 8, max: 128, trim: false });
  const row = await db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [viewer.idNum]);
  if (!row) throw new HttpError(404, 'ユーザーが見つかりません');
  if (hasUsablePassword(row.password_hash)) {
    const current = str(body.current, '現在のパスワード', { min: 1, max: 128, trim: false });
    if (!(await verifyPassword(current, row.password_hash))) throw new HttpError(400, '現在のパスワードが正しくありません');
  }
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(next), viewer.idNum]);
  return { ok: true };
});
