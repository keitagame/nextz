import { authed, open, viewerIdOf, intId } from '@/lib/http';
import { deleteChannel, requireChannel } from '@/lib/channels';

export const GET = open(async ({ params, viewer }) => ({ channel: await requireChannel(intId(params.id), viewerIdOf(viewer)) }));

/** チャンネルの削除（管理者のみ） */
export const DELETE = authed(async ({ params, viewer }) => {
  await deleteChannel(intId(params.id), viewer.idNum);
  return { ok: true };
});
