import { authed, readJson, str, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { MAX_DECORATIONS } from '@/lib/decorations';
import { validateMediaUrl } from '@/lib/media';
import { rateLimit } from '@/lib/ratelimit';
import type { AvatarDecoration } from '@/types/post';

interface Row {
  id: number;
  name: string;
  image: string;
  created_by: number | null;
}

const toDecoration = (r: Row, viewerId: number): AvatarDecoration => ({
  id: String(r.id),
  name: r.name,
  url: r.image,
  mine: r.created_by === viewerId,
});

/** 登録済みのアイコンデコレーション（フレーム画像）をすべて返す */
export const GET = authed(async ({ viewer }) => {
  const rows = await db.all<Row>('SELECT id, name, image, created_by FROM avatar_decorations ORDER BY id DESC');
  return { items: rows.map((r) => toDecoration(r, viewer.idNum)) };
});

/** デコレーションを登録する（画像は先に /api/upload（kind=decoration）でアップロード済みの URL） */
export const POST = authed(async ({ req, viewer }) => {
  await rateLimit(`decoration-create:${viewer.idNum}`, 20, 60 * 60 * 1000);
  const body = await readJson(req);
  const name = str(body.name, '名前', { min: 1, max: 30 });
  const image = validateMediaUrl(body.image, 'デコレーションの画像');
  if (/\.jpg$/i.test(image)) throw new HttpError(400, 'デコレーションには透過に対応した PNG / GIF / WebP を使ってください');

  const total = await db.get<{ c: number }>('SELECT COUNT(*) AS c FROM avatar_decorations');
  if ((total?.c ?? 0) >= MAX_DECORATIONS) throw new HttpError(400, `登録できるデコレーションは${MAX_DECORATIONS}個までです`);

  const r = await db.run('INSERT INTO avatar_decorations (name, image, created_by, created_at) VALUES (?, ?, ?, ?) RETURNING id', [name, image, viewer.idNum, Date.now()]);
  return { decoration: { id: String(r.lastId), name, url: image, mine: true } satisfies AvatarDecoration };
});
