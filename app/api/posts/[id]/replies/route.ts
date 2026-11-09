import { authed, cursorOf, intId } from '@/lib/http';
import { repliesPage } from '@/lib/posts';

export const GET = authed(async ({ req, params, viewer }) => {
  return repliesPage(intId(params.id), viewer.idNum, cursorOf(req, 0));
});
