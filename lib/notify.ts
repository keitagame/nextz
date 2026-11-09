import 'server-only';
import { db, type Executor } from './db';
import type { NotificationType } from '@/types/post';

/** 通知を作成する。自分自身への通知は作らない。like / repost / follow / reaction（同じ絵文字）は重複しない。 */
export async function notify(
  userId: number,
  actorId: number,
  type: NotificationType,
  postId: number | null = null,
  ex: Executor = db,
  /** reaction 通知のときの絵文字 */
  emojiId: number | null = null,
) {
  if (userId === actorId) return;
  await ex.run(
    'INSERT INTO notifications (user_id, actor_id, type, post_id, emoji_id, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
    [userId, actorId, type, postId, emojiId, Date.now()],
  );
}

export async function unnotify(
  userId: number,
  actorId: number,
  type: NotificationType,
  postId: number | null = null,
  emojiId: number | null = null,
) {
  await db.run(
    'DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = ? AND COALESCE(post_id, 0) = ? AND COALESCE(emoji_id, 0) = ?',
    [userId, actorId, type, postId ?? 0, emojiId ?? 0],
  );
}
