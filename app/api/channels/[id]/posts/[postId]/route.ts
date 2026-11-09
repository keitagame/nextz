import { authed, intId } from '@/lib/http';
import { deleteChannelPost } from '@/lib/channels';

export const DELETE = authed(async ({ params, viewer }) => {
  await deleteChannelPost(intId(params.id), intId(params.postId, '投稿ID'), viewer.idNum);
  return { ok: true };
});
