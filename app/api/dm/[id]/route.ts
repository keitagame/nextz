import { authed, readJson, str, intId, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { toUser, USER_COLS, type UserRow } from '@/lib/users';
import { MAX_DM_LENGTH } from '@/lib/text';
import type { DmMessage } from '@/types/post';

async function loadThread(id: number, me: number) {
  const t = await db.get<UserRow & { id: number }>(
    `SELECT t.id, ${USER_COLS} FROM dm_threads t
     JOIN users u ON u.id = CASE WHEN t.user_a = @me THEN t.user_b ELSE t.user_a END
     WHERE t.id = @id AND (t.user_a = @me OR t.user_b = @me)`,
    { id, me },
  );
  if (!t) throw new HttpError(404, '会話が見つかりません');
  return t;
}

interface MsgRow {
  id: number;
  sender_id: number;
  body: string;
  created_at: number;
}

const toMsg = (m: MsgRow, me: number): DmMessage => ({
  id: String(m.id),
  mine: m.sender_id === me,
  body: m.body,
  createdAt: new Date(m.created_at).toISOString(),
});

export const GET = authed(async ({ params, viewer }) => {
  const id = intId(params.id);
  const me = viewer.idNum;
  const t = await loadThread(id, me);
  // 開いた時点で相手のメッセージを既読にする
  await db.run('UPDATE dm_messages SET read_at = ? WHERE thread_id = ? AND sender_id <> ? AND read_at IS NULL', [Date.now(), id, me]);
  const rows = await db.all<MsgRow>('SELECT id, sender_id, body, created_at FROM dm_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 200', [id]);
  return { other: toUser(t), messages: rows.reverse().map((m) => toMsg(m, me)) };
});

export const POST = authed(async ({ req, params, viewer }) => {
  await rateLimit(`dm:${viewer.idNum}`, 60, 60 * 1000);
  const id = intId(params.id);
  await loadThread(id, viewer.idNum);
  const body = str((await readJson(req)).body, 'メッセージ', { min: 1, max: MAX_DM_LENGTH });
  const now = Date.now();
  const r = await db.run('INSERT INTO dm_messages (thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?) RETURNING id', [id, viewer.idNum, body, now]);
  return { message: toMsg({ id: r.lastId, sender_id: viewer.idNum, body, created_at: now }, viewer.idNum) };
});
