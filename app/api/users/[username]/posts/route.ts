import { authed, cursorOf, HttpError } from '@/lib/http';
import { MAX_CURSOR, userPostsPage } from '@/lib/posts';
import { getUserIdByName } from '@/lib/users';

export const GET = authed(async ({ req, params, viewer }) => {
  const userId = await getUserIdByName(params.username);
  if (!userId) throw new HttpError(404, 'このアカウントは存在しません');
  const t = req.nextUrl.searchParams.get('tab');
  const tab = t === 'replies' || t === 'media' || t === 'likes' ? t : 'posts';
  // いいね一覧は本人のみ閲覧可能
  if (tab === 'likes' && userId !== viewer.idNum) throw new HttpError(403, 'いいねは本人のみ表示できます');
  return userPostsPage({ tab, userId, viewerId: viewer.idNum, cursor: cursorOf(req, MAX_CURSOR) });
});
