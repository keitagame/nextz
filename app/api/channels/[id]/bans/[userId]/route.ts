import { authed, intId } from '@/lib/http';
import { unbanMember } from '@/lib/channels';

/** キックの解除（管理者のみ）。解除後は本人が自分で再参加できる */
export const DELETE = authed(async ({ params, viewer }) => {
  await unbanMember(intId(params.id), viewer.idNum, intId(params.userId, 'ユーザーID'));
  return { ok: true };
});
