import { authed } from '@/lib/http';
import { db } from '@/lib/db';
import { SUMMARY_COLS, toSummary } from '@/lib/users';

export const GET = authed(async ({ req, viewer }) => {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 5, 20);
  const rows = await db.all(
    `SELECT ${SUMMARY_COLS} FROM users u
     WHERE u.id <> @viewer AND u.banned_at IS NULL AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = @viewer AND f.followee_id = u.id)
     ORDER BY
       (SELECT COUNT(*) FROM follows f1 JOIN follows f2 ON f1.followee_id = f2.follower_id
          WHERE f1.follower_id = @viewer AND f2.followee_id = u.id) DESC,
       (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) DESC, u.id DESC
     LIMIT @lim`,
    { viewer: viewer.idNum, lim: limit },
  );
  return { items: (rows as never[]).map(toSummary) };
});
