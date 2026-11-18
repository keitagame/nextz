import { authed, intId, HttpError } from '@/lib/http';
import { db } from '@/lib/db';

/**
 * 絵文字を削除する（登録者のみ）。
 * その絵文字のリアクション・通知は ON DELETE CASCADE、誰かのバッジは ON DELETE SET NULL で自動的に消える。
 * 本文中の :shortcode: は文字列のまま残る（表示は通常のテキストに戻る）。
 */
export const DELETE = authed(async ({ params, viewer }) => {
  const id = intId(params.id);
  const row = await db.get<{ created_by: number | null }>('SELECT created_by FROM custom_emojis WHERE id = ?', [id]);
  if (!row) throw new HttpError(404, '絵文字が見つかりません');
  if (row.created_by !== viewer.idNum) throw new HttpError(403, '自分が登録した絵文字のみ削除できます');
  await db.run('DELETE FROM custom_emojis WHERE id = ?', [id]);
  return { ok: true };
});
