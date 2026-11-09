import { authed, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { notify, unnotify } from '@/lib/notify';
import { getProfile, getUserIdByName } from '@/lib/users';

async function target(username: string, viewerId: number) {
  const id = await getUserIdByName(username);
  if (!id) throw new HttpError(404, 'このアカウントは存在しません');
  if (id === viewerId) throw new HttpError(400, '自分自身はフォローできません');
  return id;
}

export const POST = authed(async ({ params, viewer }) => {
  const id = await target(params.username, viewer.idNum);
  await db.run('INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [viewer.idNum, id, Date.now()]);
  await notify(id, viewer.idNum, 'follow');
  return { user: await getProfile(params.username, viewer.idNum) };
});

export const DELETE = authed(async ({ params, viewer }) => {
  const id = await target(params.username, viewer.idNum);
  await db.run('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', [viewer.idNum, id]);
  await unnotify(id, viewer.idNum, 'follow');
  return { user: await getProfile(params.username, viewer.idNum) };
});
