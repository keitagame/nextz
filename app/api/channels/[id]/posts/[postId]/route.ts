import { authed, HttpError, intId } from '@/lib/http';
import { db } from '@/lib/db';
import { deletePost } from '@/lib/posts';

/** チャンネル内のポストの削除。投稿者本人またはチャンネル管理者のみ（権限判定は deletePost） */
export const DELETE = authed(async ({ params, viewer }) => {
  const channelId = intId(params.id);
  const postId = intId(params.postId, '投稿ID');
  const row = await db.get('SELECT 1 AS ok FROM posts WHERE id = ? AND channel_id = ?', [postId, channelId]);
  if (!row) throw new HttpError(404, '投稿が見つかりません');
  await deletePost(postId, viewer.idNum);
  return { ok: true };
});
