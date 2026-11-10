import { authed, intId, HttpError } from '@/lib/http';
import { db } from '@/lib/db';

/** デコレーションを削除する（登録者のみ）。使っている人のデコレーションは ON DELETE SET NULL で自動的に外れる。 */
export const DELETE = authed(async ({ params, viewer }) => {
  const id = intId(params.id);
  const row = await db.get<{ created_by: number | null }>('SELECT created_by FROM avatar_decorations WHERE id = ?', [id]);
  if (!row) throw new HttpError(404, 'デコレーションが見つかりません');
  if (row.created_by !== viewer.idNum) throw new HttpError(403, '自分が登録したデコレーションのみ削除できます');
  await db.run('DELETE FROM avatar_decorations WHERE id = ?', [id]);
  return { ok: true };
});
