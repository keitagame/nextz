import { authed, readJson, str, intId, cursorOf, HttpError } from '@/lib/http';
import { createPost, feedPage, getPost, MAX_CURSOR } from '@/lib/posts';
import { rateLimit } from '@/lib/ratelimit';
import { validateMediaUrl } from '@/lib/media';
import { countChars, MAX_IMAGES, MAX_POST_LENGTH } from '@/lib/text';

export const GET = authed(async ({ req, viewer }) => {
  const feed = req.nextUrl.searchParams.get('feed') === 'following' ? 'following' : 'for-you';
  return feedPage({ scope: feed, viewerId: viewer.idNum, cursor: cursorOf(req, MAX_CURSOR) });
});

export const POST = authed(async ({ req, viewer }) => {
  await rateLimit(`post:${viewer.idNum}`, 30, 60 * 1000, '投稿が多すぎます。少し待ってからお試しください');
  const body = await readJson(req);
  const content = str(body.content, 'ポスト', { max: MAX_POST_LENGTH });
  if (countChars(content) > MAX_POST_LENGTH) throw new HttpError(400, `ポストは${MAX_POST_LENGTH}文字以内で入力してください`);

  const rawImages = body.images ?? [];
  if (!Array.isArray(rawImages) || rawImages.length > MAX_IMAGES) throw new HttpError(400, `画像は${MAX_IMAGES}枚までです`);
  const images = rawImages.map((u) => validateMediaUrl(u));

  const parentId = body.parentId ? intId(body.parentId, '返信先') : null;
  const quoteOf = body.quoteOf ? intId(body.quoteOf, '引用元') : null;
  if (!content && images.length === 0) throw new HttpError(400, 'ポストの内容を入力してください');

  const id = await createPost({ userId: viewer.idNum, content, images, parentId, quoteOf });
  return { post: await getPost(id, viewer.idNum) };
});
