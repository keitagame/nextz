import { authed, readJson, str, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { getUserIdByName, toUser, USER_COLS, type UserRow } from '@/lib/users';
import type { DmThread } from '@/types/post';

interface Row extends UserRow {
  tid: number;
  last_body: string | null;
  last_at: number | null;
  last_sender: number | null;
  created_at: number;
  unread: number;
}

export const GET = authed(async ({ viewer }) => {
  const me = viewer.idNum;
  const rows = await db.all<Row>(
    `SELECT t.id AS tid, t.created_at, ${USER_COLS},
         (SELECT body FROM dm_messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
         (SELECT created_at FROM dm_messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_at,
         (SELECT sender_id FROM dm_messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_sender,
         (SELECT COUNT(*) FROM dm_messages m WHERE m.thread_id = t.id AND m.sender_id <> @me AND m.read_at IS NULL) AS unread
       FROM dm_threads t JOIN users u ON u.id = CASE WHEN t.user_a = @me THEN t.user_b ELSE t.user_a END
       WHERE (t.user_a = @me OR t.user_b = @me) AND EXISTS (SELECT 1 FROM dm_messages m WHERE m.thread_id = t.id)
     ORDER BY last_at DESC`,
    { me },
  );
  const items: DmThread[] = rows.map((r) => ({
    id: String(r.tid),
    other: toUser(r),
    lastMessage: r.last_body
      ? { body: r.last_body, createdAt: new Date(r.last_at as number).toISOString(), mine: r.last_sender === me }
      : null,
    unreadCount: r.unread,
    updatedAt: new Date(r.last_at ?? r.created_at).toISOString(),
  }));
  return { items };
});

/** 指定ユーザーとのスレッドを取得（なければ作成）して ID を返す */
export const POST = authed(async ({ req, viewer }) => {
  const body = await readJson(req);
  const username = str(body.username, 'ユーザー名', { min: 1, max: 16 }).replace(/^@/, '');
  const otherId = await getUserIdByName(username);
  if (!otherId) throw new HttpError(404, 'このアカウントは存在しません');
  if (otherId === viewer.idNum) throw new HttpError(400, '自分自身にはメッセージを送れません');
  const [a, b] = [viewer.idNum, otherId].sort((x, y) => x - y);
  await db.run('INSERT INTO dm_threads (user_a, user_b, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [a, b, Date.now()]);
  const t = await db.get<{ id: number }>('SELECT id FROM dm_threads WHERE user_a = ? AND user_b = ?', [a, b]);
  return { id: String(t!.id) };
});
