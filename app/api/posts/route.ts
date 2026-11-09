import { authed, readJson, str, intId, cursorOf, HttpError } from '@/lib/http';
import { createPost, feedPage, getPost, MAX_CURSOR } from '@/lib/posts';
import { rateLimit } from '@/lib/ratelimit';
import { validateMediaUrl } from '@/lib/media';
import { MAX_CHANNEL_POST_LENGTH, MAX_IMAGES } from '@/lib/text';

export const GET = authed(async ({ req, viewer }) => {
  const feed = req.nextUrl.searchParams.get('feed') === 'following' ? 'following' : 'for-you';
  return feedPage({ scope: feed, viewerId: viewer.idNum, cursor: cursorOf(req, MAX_CURSOR) });
});

export const POST = authed(async ({ req, viewer }) => {
  await rateLimit(`post:${viewer.idNum}`, 30, 60 * 1000, '投稿が多すぎます。少し待ってからお試しください');
  const body = await readJson(req);
  // 文字数の上限はチャンネル内か（500字）グローバルか（280字）で変わるため、ここでは緩い上限だけ見て、正確な判定は createPost で行う
  const content = str(body.content, 'ポスト', { max: MAX_CHANNEL_POST_LENGTH });

  const rawImages = body.images ?? [];
  if (!Array.isArray(rawImages) || rawImages.length > MAX_IMAGES) throw new HttpError(400, `画像は${MAX_IMAGES}枚までです`);
  const images = rawImages.map((u) => validateMediaUrl(u));

  const parentId = body.parentId ? intId(body.parentId, '返信先') : null;
  const quoteOf = body.quoteOf ? intId(body.quoteOf, '引用元') : null;
  const channelId = body.channelId ? intId(body.channelId, 'チャンネルID') : null;
  if (!content && images.length === 0) throw new HttpError(400, 'ポストの内容を入力してください');

  const id = await createPost({ userId: viewer.idNum, content, images, parentId, quoteOf, channelId });
  return { post: await getPost(id, viewer.idNum) };
});
