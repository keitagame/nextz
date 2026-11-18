import { authed, intId, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { assertChannelMember, getPost } from '@/lib/posts';
import { notify, unnotify } from '@/lib/notify';

type Action = 'like' | 'repost' | 'bookmark';

async function apply(action: string, on: boolean, postId: number, userId: number) {
  if (action !== 'like' && action !== 'repost' && action !== 'bookmark') throw new HttpError(404, 'Not found');
  const target = await db.get<{ user_id: number; channel_id: number | null }>(
    'SELECT user_id, channel_id FROM posts WHERE id = ? AND deleted_at IS NULL AND repost_of IS NULL',
    [postId],
  );
  if (!target) throw new HttpError(404, 'ポストが見つかりません');
  // チャンネル内のポストへのいいね・リポストはメンバーのみ（取り消しと、自分用のブックマークは誰でも可）
  if (on && action !== 'bookmark') await assertChannelMember(target.channel_id, userId, 'チャンネルに参加すると操作できます');
  const now = Date.now();
  const a: Action = action;

  if (a === 'like') {
    if (on) {
      await db.run('INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [userId, postId, now]);
      await notify(target.user_id, userId, 'like', postId);
    } else {
      await db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId]);
      await unnotify(target.user_id, userId, 'like', postId);
    }
  } else if (a === 'bookmark') {
    if (on) await db.run('INSERT INTO bookmarks (user_id, post_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [userId, postId, now]);
    else await db.run('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?', [userId, postId]);
  } else {
    if (on) {
      // リポストは元のポストと同じ場所（グローバル / 同じチャンネル）のタイムラインに出る
      await db.run('INSERT INTO posts (user_id, repost_of, content, images, channel_id, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING', [
        userId,
        postId,
        '',
        '[]',
        target.channel_id,
        now,
      ]);
      await notify(target.user_id, userId, 'repost', postId);
    } else {
      await db.run('DELETE FROM posts WHERE user_id = ? AND repost_of = ?', [userId, postId]);
      await unnotify(target.user_id, userId, 'repost', postId);
    }
  }
}

export const POST = authed(async ({ params, viewer }) => {
  const id = intId(params.id);
  await apply(params.action, true, id, viewer.idNum);
  return { post: await getPost(id, viewer.idNum) };
});

export const DELETE = authed(async ({ params, viewer }) => {
  const id = intId(params.id);
  await apply(params.action, false, id, viewer.idNum);
  return { post: await getPost(id, viewer.idNum) };
});
