import { adminOnly, readJson, str, HttpError } from '@/lib/http';
import { transaction } from '@/lib/db';
import { isAdminUsername } from '@/lib/admin';
import { rateLimit } from '@/lib/ratelimit';

/**
 * 管理者：アカウントを強制削除する（そのアカウントの全ポストも削除）。元に戻せない。
 * body.confirm に対象のユーザー名を入れて送る（誤操作防止）。
 *
 * 削除されるもの: ユーザー本体・セッション・全ポスト（リポスト含む）・いいね・ブックマーク・フォロー・通知・リアクション・
 *   本人が作成したチャンネル（中のポストごと）・本人が所有するボット（ボットのアカウントとそのポスト）・凍結履歴。
 * 他のユーザーのポストへの影響:
 *   - このアカウントのポストを引用していたポスト → 引用部分だけ外れる（ポスト自体は残る）
 *   - このアカウントのポストへの返信 → 親が消えるため、削除済みポストとして扱う
 */
export const DELETE = adminOnly(async ({ req, params, viewer }) => {
  await rateLimit(`admin-delete:${viewer.idNum}`, 20, 60 * 60 * 1000);
  const body = await readJson(req);
  const confirm = str(body.confirm, '確認用のユーザー名', { min: 1, max: 100 });

  await transaction(async (tx) => {
    const t = await tx.get<{ id: number; username: string }>(
      'SELECT id, username FROM users WHERE lower(username) = lower(?) FOR UPDATE',
      [params.username],
    );
    if (!t) throw new HttpError(404, 'このアカウントは存在しません');
    if (t.id === viewer.idNum) throw new HttpError(400, '自分自身は削除できません');
    if (isAdminUsername(t.username)) throw new HttpError(403, '管理者アカウントは削除できません');
    if (confirm.replace(/^@/, '').toLowerCase() !== t.username.toLowerCase()) {
      throw new HttpError(400, '確認用のユーザー名が一致しません');
    }

    // 対象 = 本人 + 本人が所有するボット（ボットのアカウントは users 行なので、残すと所有者のいない孤児になる）
    const bots = await tx.all<{ user_id: number }>('SELECT user_id FROM bots WHERE owner_id = ?', [t.id]);
    const ids = [t.id, ...bots.map((b) => b.user_id)];

    // 本人のポストを参照している他人のポストを切り離す（posts.parent_id / quote_of は ON DELETE 指定がなく、残っていると削除に失敗する）
    const mine = 'SELECT id FROM posts WHERE user_id = ANY(@ids::bigint[])';
    const now = Date.now();
    await tx.run(`UPDATE posts SET quote_of = NULL WHERE quote_of IN (${mine}) AND user_id <> ALL(@ids::bigint[])`, { ids });
    await tx.run(
      `UPDATE posts SET parent_id = NULL, deleted_at = COALESCE(deleted_at, @now), content = '', images = '[]'
       WHERE parent_id IN (${mine}) AND user_id <> ALL(@ids::bigint[])`,
      { ids, now },
    );
    // 本人が所有するチャンネルは中のポストごと消えるので、他人のポストからの参照も先に切り離す
    const inChannels = 'SELECT id FROM posts WHERE channel_id IN (SELECT id FROM channels WHERE owner_id = ANY(@ids::bigint[]))';
    await tx.run(`UPDATE posts SET quote_of = NULL WHERE quote_of IN (${inChannels}) AND user_id <> ALL(@ids::bigint[])`, { ids });
    await tx.run(
      `UPDATE posts SET parent_id = NULL, deleted_at = COALESCE(deleted_at, @now), content = '', images = '[]'
       WHERE parent_id IN (${inChannels}) AND user_id <> ALL(@ids::bigint[])`,
      { ids, now },
    );

    // 本人どうしの参照（自分への返信・自分の引用）は FK がぶつからないよう先に外してから消す
    await tx.run('UPDATE posts SET parent_id = NULL, quote_of = NULL WHERE user_id = ANY(@ids::bigint[])', { ids });
    // posts / sessions / likes / bookmarks / follows / notifications / reactions / channels / bots などは ON DELETE CASCADE で一緒に消える
    await tx.run('DELETE FROM users WHERE id = ANY(@ids::bigint[])', { ids });
  });
  return { ok: true };
});
