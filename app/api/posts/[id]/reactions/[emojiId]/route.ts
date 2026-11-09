import { authed, intId, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { assertChannelMember, getPost } from '@/lib/posts';
import { notify, unnotify } from '@/lib/notify';
import { rateLimit } from '@/lib/ratelimit';
import { MAX_REACTIONS_PER_POST } from '@/lib/text';

async function apply(on: boolean, postId: number, emojiId: number, userId: number) {
  const target = await db.get<{ user_id: number; channel_id: number | null }>(
    'SELECT user_id, channel_id FROM posts WHERE id = ? AND deleted_at IS NULL AND repost_of IS NULL',
    [postId],
  );
  if (!target) throw new HttpError(404, 'ポストが見つかりません');

  if (on) {
    await assertChannelMember(target.channel_id, userId, 'リアクションするにはチャンネルに参加してください');
    await rateLimit(`react:${userId}`, 120, 10 * 60 * 1000);
    const emoji = await db.get<{ id: number }>('SELECT id FROM custom_emojis WHERE id = ?', [emojiId]);
    if (!emoji) throw new HttpError(404, '絵文字が見つかりません');

    const mine = await db.get<{ c: number; has: number }>(
      'SELECT COUNT(*) AS c, COUNT(*) FILTER (WHERE emoji_id = ?) AS has FROM post_reactions WHERE user_id = ? AND post_id = ?',
      [emojiId, userId, postId],
    );
    if ((mine?.has ?? 0) === 0 && (mine?.c ?? 0) >= MAX_REACTIONS_PER_POST) {
      throw new HttpError(400, `1つのポストに付けられるリアクションは${MAX_REACTIONS_PER_POST}種類までです`);
    }
    const r = await db.run('INSERT INTO post_reactions (user_id, post_id, emoji_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING', [
      userId,
      postId,
      emojiId,
      Date.now(),
    ]);
    if (r.changes > 0) await notify(target.user_id, userId, 'reaction', postId, db, emojiId);
  } else {
    await db.run('DELETE FROM post_reactions WHERE user_id = ? AND post_id = ? AND emoji_id = ?', [userId, postId, emojiId]);
    await unnotify(target.user_id, userId, 'reaction', postId, emojiId);
  }
}

/** リアクションを付ける */
export const PUT = authed(async ({ params, viewer }) => {
  const postId = intId(params.id);
  await apply(true, postId, intId(params.emojiId, '絵文字ID'), viewer.idNum);
  return { post: await getPost(postId, viewer.idNum) };
});

/** リアクションを外す */
export const DELETE = authed(async ({ params, viewer }) => {
  const postId = intId(params.id);
  await apply(false, postId, intId(params.emojiId, '絵文字ID'), viewer.idNum);
  return { post: await getPost(postId, viewer.idNum) };
});
