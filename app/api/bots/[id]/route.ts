import { humanOnly, readJson, str } from '@/lib/http';
import { db } from '@/lib/db';
import { getBot, ownedBotId } from '@/lib/bots';

/** ボットの表示名を変更する（アイコン等はボット自身が PATCH /api/me で変更できる） */
export const PATCH = humanOnly(async ({ req, params, viewer }) => {
  const id = await ownedBotId(params.id, viewer.idNum);
  const body = await readJson(req);
  const name = str(body.name, '表示名', { min: 1, max: 30 });
  await db.run('UPDATE users SET display_name = ? WHERE id = ?', [name, id]);
  return { bot: await getBot(id) };
});

/** ボットを削除する。投稿・フォロー・DM などボットのデータも一緒に消える */
export const DELETE = humanOnly(async ({ params, viewer }) => {
  const id = await ownedBotId(params.id, viewer.idNum);
  await db.run('DELETE FROM users WHERE id = ?', [id]);
  return { ok: true };
});
