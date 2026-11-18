import { authed, cursorOf } from '@/lib/http';
import { db } from '@/lib/db';
import { bookmarksPage, MAX_CURSOR } from '@/lib/posts';

export const GET = authed(async ({ req, viewer }) => bookmarksPage(viewer.idNum, cursorOf(req, MAX_CURSOR)));

export const DELETE = authed(async ({ viewer }) => {
  await db.run('DELETE FROM bookmarks WHERE user_id = ?', [viewer.idNum]);
  return { ok: true };
});
