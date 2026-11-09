import { authed, readJson, str, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { validateMediaUrl } from '@/lib/media';
import { rateLimit } from '@/lib/ratelimit';
import { SHORTCODE_RE } from '@/lib/text';
import type { CustomEmoji } from '@/types/post';

const MAX_EMOJIS = 1000;

interface Row {
  id: number;
  shortcode: string;
  image: string;
  created_by: number | null;
}

const toEmoji = (r: Row, viewerId: number): CustomEmoji => ({
  id: String(r.id),
  shortcode: r.shortcode,
  url: r.image,
  mine: r.created_by === viewerId,
});

/** 登録済みのカスタム絵文字をすべて返す（本文の :shortcode: 表示・ピッカー・設定画面で共用） */
export const GET = authed(async ({ viewer }) => {
  const rows = await db.all<Row>('SELECT id, shortcode, image, created_by FROM custom_emojis ORDER BY lower(shortcode)');
  return { items: rows.map((r) => toEmoji(r, viewer.idNum)) };
});

/** カスタム絵文字を登録する（画像は先に /api/upload?kind=emoji 相当でアップロード済みの URL） */
export const POST = authed(async ({ req, viewer }) => {
  await rateLimit(`emoji-create:${viewer.idNum}`, 20, 60 * 60 * 1000);
  const body = await readJson(req);
  const shortcode = str(body.shortcode, 'ショートコード', { min: 2, max: 32 }).toLowerCase();
  if (!SHORTCODE_RE.test(shortcode)) throw new HttpError(400, 'ショートコードは英数字とアンダースコアの2〜32文字にしてください');
  const image = validateMediaUrl(body.image, '絵文字の画像');

  const total = await db.get<{ c: number }>('SELECT COUNT(*) AS c FROM custom_emojis');
  if ((total?.c ?? 0) >= MAX_EMOJIS) throw new HttpError(400, `登録できる絵文字は${MAX_EMOJIS}個までです`);

  const r = await db.run(
    'INSERT INTO custom_emojis (shortcode, image, created_by, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING id',
    [shortcode, image, viewer.idNum, Date.now()],
  );
  if (r.changes === 0) throw new HttpError(409, `:${shortcode}: はすでに使われています`);
  return { emoji: { id: String(r.lastId), shortcode, url: image, mine: true } satisfies CustomEmoji };
});
