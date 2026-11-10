import { authed } from '@/lib/http';
import { db } from '@/lib/db';
import { toUser, USER_COLS, type UserRow } from '@/lib/users';
import type { ActiveUser } from '@/types/post';

/** 「アクティブ」とみなす最終アクセスからの時間 */
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export const GET = authed(async ({ viewer }) => {
  const rows = await db.all<UserRow & { last_seen_at: number }>(
    `SELECT ${USER_COLS}, u.last_seen_at FROM users u
     WHERE u.last_seen_at > @since AND u.id <> @viewer AND u.banned_at IS NULL
     ORDER BY u.last_seen_at DESC LIMIT 30`,
    { since: Date.now() - ACTIVE_WINDOW_MS, viewer: viewer.idNum },
  );
  const items: ActiveUser[] = rows.map((r) => ({ ...toUser(r), lastSeenAt: new Date(r.last_seen_at).toISOString() }));
  return { items };
});
