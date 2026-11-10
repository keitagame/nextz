import { adminOnly, readJson, str, HttpError } from '@/lib/http';
import { transaction, type Executor } from '@/lib/db';
import { isAdminUsername } from '@/lib/admin';
import { getAdminUser } from '@/lib/moderation';
import { rateLimit } from '@/lib/ratelimit';
import { MAX_BAN_REASON_LENGTH } from '@/lib/text';

interface Target {
  id: number;
  username: string;
  banned_at: number | null;
}

async function findTarget(tx: Executor, username: string, adminId: number): Promise<Target> {
  // 同時に凍結・解除が走っても矛盾しないよう、行をロックして読む
  const t = await tx.get<Target>('SELECT id, username, banned_at FROM users WHERE lower(username) = lower(?) FOR UPDATE', [username]);
  if (!t) throw new HttpError(404, 'このアカウントは存在しません');
  if (t.id === adminId) throw new HttpError(400, '自分自身は凍結できません');
  if (isAdminUsername(t.username)) throw new HttpError(403, '管理者アカウントは凍結できません');
  return t;
}

/** 管理者：アカウントを凍結する（理由は必須）。全セッションを破棄し、ログイン・API・所有するボットのトークンを無効にする */
export const POST = adminOnly(async ({ req, params, viewer }) => {
  await rateLimit(`admin-ban:${viewer.idNum}`, 60, 60 * 60 * 1000);
  const body = await readJson(req);
  const reason = str(body.reason, '凍結の理由', { min: 1, max: MAX_BAN_REASON_LENGTH });

  await transaction(async (tx) => {
    const t = await findTarget(tx, params.username, viewer.idNum);
    if (t.banned_at) throw new HttpError(409, 'このアカウントはすでに凍結されています');
    const now = Date.now();
    await tx.run('UPDATE users SET banned_at = ?, ban_reason = ?, banned_by = ? WHERE id = ?', [now, reason, viewer.idNum, t.id]);
    await tx.run('DELETE FROM sessions WHERE user_id = ?', [t.id]);
    await tx.run("INSERT INTO moderation_logs (target_id, admin_id, action, reason, created_at) VALUES (?, ?, 'ban', ?, ?)", [t.id, viewer.idNum, reason, now]);
  });
  return { user: await getAdminUser(params.username) };
});

/** 管理者：凍結を解除する */
export const DELETE = adminOnly(async ({ params, viewer }) => {
  await rateLimit(`admin-ban:${viewer.idNum}`, 60, 60 * 60 * 1000);
  await transaction(async (tx) => {
    const t = await findTarget(tx, params.username, viewer.idNum);
    if (!t.banned_at) throw new HttpError(409, 'このアカウントは凍結されていません');
    await tx.run("UPDATE users SET banned_at = NULL, ban_reason = '', banned_by = NULL WHERE id = ?", [t.id]);
    await tx.run("INSERT INTO moderation_logs (target_id, admin_id, action, reason, created_at) VALUES (?, ?, 'unban', '', ?)", [t.id, viewer.idNum, Date.now()]);
  });
  return { user: await getAdminUser(params.username) };
});
