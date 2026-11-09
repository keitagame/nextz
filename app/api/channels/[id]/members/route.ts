import { authed, intId } from '@/lib/http';
import { joinChannel, leaveChannel, listMembers, requireChannel } from '@/lib/channels';

export const GET = authed(async ({ params, viewer }) => {
  const channel = await requireChannel(intId(params.id), viewer.idNum);
  return listMembers(channel);
});

/** 参加 */
export const POST = authed(async ({ params, viewer }) => {
  const id = intId(params.id);
  await joinChannel(id, viewer.idNum);
  return { channel: await requireChannel(id, viewer.idNum) };
});

/** 退出（管理者は不可） */
export const DELETE = authed(async ({ params, viewer }) => {
  const id = intId(params.id);
  await leaveChannel(id, viewer.idNum);
  return { channel: await requireChannel(id, viewer.idNum) };
});
