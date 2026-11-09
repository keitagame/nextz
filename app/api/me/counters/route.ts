import { authed } from '@/lib/http';
import { db } from '@/lib/db';
import type { Counters } from '@/types/post';

export const GET = authed(async ({ viewer }): Promise<Counters> => {
  // 最終アクセス時刻を更新（ホームの「アクティブユーザー」用）。書き込みは 1 分に 1 回までに抑える
  const now = Date.now();
  await db.run('UPDATE users SET last_seen_at = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)', [now, viewer.idNum, now - 60_000]);
  const [n, m] = await Promise.all([
    db.get<{ c: number }>('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0', [viewer.idNum]),
    db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM dm_messages m JOIN dm_threads t ON t.id = m.thread_id
       WHERE (t.user_a = @u OR t.user_b = @u) AND m.sender_id <> @u AND m.read_at IS NULL`,
      { u: viewer.idNum },
    ),
  ]);
  return { notifications: n?.c ?? 0, messages: m?.c ?? 0 };
});
