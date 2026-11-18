import { authed, intId } from '@/lib/http';
import { kickMember } from '@/lib/channels';

/** メンバーをキック（管理者のみ） */
export const DELETE = authed(async ({ params, viewer }) => {
  await kickMember(intId(params.id), viewer.idNum, intId(params.userId, 'ユーザーID'));
  return { ok: true };
});
