import { open, viewerIdOf, HttpError } from '@/lib/http';
import { getProfile } from '@/lib/users';

export const GET = open(async ({ params, viewer }) => {
  const profile = await getProfile(params.username, viewerIdOf(viewer));
  if (!profile) throw new HttpError(404, 'このアカウントは存在しません');
  return { user: profile };
});
