import { authed, cursorOf } from '@/lib/http';
import { db } from '@/lib/db';
import { MAX_CURSOR, PAGE_SIZE, searchPostsPage } from '@/lib/posts';
import { pageOfUsers, SUMMARY_COLS } from '@/lib/users';

export const GET = authed(async ({ req, viewer }) => {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim().slice(0, 100);
  const type = sp.get('type') === 'users' ? 'users' : 'posts';
  if (!q) return { items: [], nextCursor: null };

  if (type === 'posts') return searchPostsPage({ q, viewerId: viewer.idNum, cursor: cursorOf(req, MAX_CURSOR) });

  const offset = cursorOf(req, 0);
  const name = q.replace(/^@/, '');
  const pat = `%${name.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db.all(
    `SELECT ${SUMMARY_COLS} FROM users u
     WHERE u.username ILIKE @pat ESCAPE '\\' OR u.display_name ILIKE @pat ESCAPE '\\'
     ORDER BY (lower(u.username) = lower(@name)) DESC,
              (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) DESC, u.id DESC
     LIMIT @lim OFFSET @off`,
    { pat, name, viewer: viewer.idNum, lim: PAGE_SIZE + 1, off: offset },
  );
  return pageOfUsers(rows as never, PAGE_SIZE, offset);
});
