import { authed, cursorOf, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { PAGE_SIZE } from '@/lib/posts';
import { getUserIdByName, pageOfUsers, SUMMARY_COLS } from '@/lib/users';

export const GET = authed(async ({ req, params, viewer }) => {
  const userId = await getUserIdByName(params.username);
  if (!userId) throw new HttpError(404, 'このアカウントは存在しません');
  const type = req.nextUrl.searchParams.get('type') === 'following' ? 'following' : 'followers';
  const offset = cursorOf(req, 0);
  // followers: 自分(userId)をフォローしている人 / following: userId がフォローしている人
  const [me, other] = type === 'followers' ? ['followee_id', 'follower_id'] : ['follower_id', 'followee_id'];
  const rows = await db.all(
    `SELECT ${SUMMARY_COLS} FROM follows f JOIN users u ON u.id = f.${other}
     WHERE f.${me} = @user ORDER BY f.id DESC LIMIT @lim OFFSET @off`,
    { user: userId, viewer: viewer.idNum, lim: PAGE_SIZE + 1, off: offset },
  );
  return pageOfUsers(rows as never, PAGE_SIZE, offset);
});
