import { authed, open, readJson, str, intId, HttpError } from '@/lib/http';
import { db, transaction } from '@/lib/db';
import { isDecorationId, MAX_BADGES } from '@/lib/decorations';
import { getProfile } from '@/lib/users';
import { validateMediaUrl } from '@/lib/media';

export const GET = open(async ({ viewer }) => {
  if (!viewer) return { user: null };
  return { user: await getProfile(viewer.username, viewer.idNum) };
});

export const PATCH = authed(async ({ req, viewer }) => {
  const body = await readJson(req);
  const sets: string[] = [];
  const vals: Record<string, unknown> = { id: viewer.idNum };
  const set = (col: string, v: unknown) => {
    sets.push(`${col} = @${col}`);
    vals[col] = v;
  };

  if ('name' in body) set('display_name', str(body.name, '表示名', { min: 1, max: 30 }));
  if ('bio' in body) set('bio', str(body.bio, '自己紹介', { max: 160 }));
  if ('location' in body) set('location', str(body.location, '場所', { max: 30 }));
  if ('website' in body) {
    let w = str(body.website, 'ウェブサイト', { max: 100 });
    if (w) {
      if (!/^https?:\/\//i.test(w)) w = `https://${w}`;
      try {
        const u = new URL(w);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
      } catch {
        throw new HttpError(400, 'ウェブサイトのURLが正しくありません');
      }
    }
    set('website', w);
  }
  if ('avatarUrl' in body) set('avatar', body.avatarUrl === null ? null : validateMediaUrl(body.avatarUrl, 'アイコン画像'));
  if ('bannerUrl' in body) set('banner', body.bannerUrl === null ? null : validateMediaUrl(body.bannerUrl, 'ヘッダー画像'));

  if ('avatarDecoration' in body) {
    const d = body.avatarDecoration;
    if (d !== null && !isDecorationId(d)) throw new HttpError(400, 'デコレーションが正しくありません');
    set('avatar_decoration', d);
  }

  // バッジ: badgeEmojiIds（配列・表示順・最大 MAX_BADGES 個）。旧形式の badgeEmojiId（1 個 / null）も受け付ける
  let badgeIds: number[] | undefined;
  if ('badgeEmojiIds' in body || 'badgeEmojiId' in body) {
    const raw = 'badgeEmojiIds' in body ? body.badgeEmojiIds : body.badgeEmojiId === null ? [] : [body.badgeEmojiId];
    if (!Array.isArray(raw)) throw new HttpError(400, 'バッジが正しくありません');
    if (raw.length > MAX_BADGES) throw new HttpError(400, `バッジは${MAX_BADGES}個まで設定できます`);
    badgeIds = raw.map((v) => intId(v, '絵文字ID'));
    if (new Set(badgeIds).size !== badgeIds.length) throw new HttpError(400, '同じバッジを複数設定することはできません');
    if (badgeIds.length) {
      const found = await db.all<{ id: number }>('SELECT id FROM custom_emojis WHERE id = ANY(?::bigint[])', [badgeIds]);
      if (found.length !== badgeIds.length) throw new HttpError(404, '絵文字が見つかりません');
    }
  }

  if (sets.length || badgeIds) {
    await transaction(async (tx) => {
      if (sets.length) await tx.run(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`, vals as never);
      if (badgeIds) {
        await tx.run('DELETE FROM user_badges WHERE user_id = ?', [viewer.idNum]);
        for (const [i, emojiId] of badgeIds.entries()) {
          await tx.run('INSERT INTO user_badges (user_id, emoji_id, position) VALUES (?, ?, ?)', [viewer.idNum, emojiId, i]);
        }
      }
    });
  }
  return { user: await getProfile(viewer.username, viewer.idNum) };
});
