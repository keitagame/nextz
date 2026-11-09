import { authed, HttpError } from '@/lib/http';
import { getProfile } from '@/lib/users';

export const GET = authed(async ({ params, viewer }) => {
  const profile = await getProfile(params.username, viewer.idNum);
  if (!profile) throw new HttpError(404, 'このアカウントは存在しません');
  return { user: profile };
});
