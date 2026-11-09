import { authed, open, readJson, str, intId, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
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

  if ('badgeEmojiId' in body) {
    if (body.badgeEmojiId === null) set('badge_emoji_id', null);
    else {
      const id = intId(body.badgeEmojiId, '絵文字ID');
      if (!(await db.get('SELECT 1 AS ok FROM custom_emojis WHERE id = ?', [id]))) throw new HttpError(404, '絵文字が見つかりません');
      set('badge_emoji_id', id);
    }
  }

  if (sets.length) await db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`, vals as never);
  return { user: await getProfile(viewer.username, viewer.idNum) };
});
