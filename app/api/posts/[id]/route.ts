import { authed, intId, HttpError } from '@/lib/http';
import { deletePost, getAncestors, getPost } from '@/lib/posts';

export const GET = authed(async ({ params, viewer }) => {
  const post = await getPost(intId(params.id), viewer.idNum);
  if (!post || post.deleted) throw new HttpError(404, 'ポストが見つかりません');
  return { post, ancestors: await getAncestors(post, viewer.idNum) };
});

export const DELETE = authed(async ({ params, viewer }) => {
  await deletePost(intId(params.id), viewer.idNum);
  return { ok: true };
});
