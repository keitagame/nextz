import { authed, open, viewerIdOf, intId, HttpError } from '@/lib/http';
import { deletePost, getPost } from '@/lib/posts';

export const GET = open(async ({ params, viewer }) => {
  const vid = viewerIdOf(viewer);
  const post = await getPost(intId(params.id), vid);
  if (!post || post.deleted) throw new HttpError(404, 'ポストが見つかりません');
  return { post };
});

export const DELETE = authed(async ({ params, viewer }) => {
  await deletePost(intId(params.id), viewer.idNum);
  return { ok: true };
});
