import { authed, cursorOf } from '@/lib/http';
import { db } from '@/lib/db';
import { MAX_CURSOR, PAGE_SIZE } from '@/lib/posts';
import { toUser, USER_COLS, type UserRow } from '@/lib/users';
import type { AppNotification, NotificationType, Page } from '@/types/post';

interface Row extends UserRow {
  nid: number;
  type: NotificationType;
  read: number;
  created_at: number;
  post_id: number | null;
  post_content: string | null;
  emoji_id: number | null;
  emoji_code: string | null;
  emoji_image: string | null;
}

export const GET = authed(async ({ req, viewer }): Promise<Page<AppNotification>> => {
  const cursor = cursorOf(req, MAX_CURSOR);
  const mentionsOnly = req.nextUrl.searchParams.get('filter') === 'mentions';
  const rows = await db.all<Row>(
    `SELECT n.id AS nid, n.type, n.read, n.created_at, n.post_id, p.content AS post_content,
       n.emoji_id, ne.shortcode AS emoji_code, ne.image AS emoji_image, ${USER_COLS}
     FROM notifications n JOIN users u ON u.id = n.actor_id LEFT JOIN posts p ON p.id = n.post_id
     LEFT JOIN custom_emojis ne ON ne.id = n.emoji_id
     WHERE n.user_id = @viewer AND n.id < @cursor
       ${mentionsOnly ? "AND n.type IN ('reply', 'mention', 'quote')" : ''}
     ORDER BY n.id DESC LIMIT @lim`,
    { viewer: viewer.idNum, cursor, lim: PAGE_SIZE + 1 },
  );
  const hasMore = rows.length > PAGE_SIZE;
  const slice = rows.slice(0, PAGE_SIZE);
  return {
    items: slice.map((r) => ({
      id: String(r.nid),
      type: r.type,
      actor: toUser(r),
      read: !!r.read,
      createdAt: new Date(r.created_at).toISOString(),
      post: r.post_id ? { id: String(r.post_id), content: (r.post_content ?? '').slice(0, 100) } : null,
      emoji: r.emoji_id && r.emoji_code && r.emoji_image ? { id: String(r.emoji_id), shortcode: r.emoji_code, url: r.emoji_image } : null,
    })),
    nextCursor: hasMore ? String(slice[slice.length - 1].nid) : null,
  };
});

/** 全件を既読にする */
export const POST = authed(async ({ viewer }) => {
  await db.run('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0', [viewer.idNum]);
  return { ok: true };
});
