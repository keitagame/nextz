import { authed, cursorOf, HttpError, intId, readJson, str } from '@/lib/http';
import { requireChannel } from '@/lib/channels';
import { rateLimit } from '@/lib/ratelimit';
import { validateMediaUrl } from '@/lib/media';
import { MAX_CHANNEL_POST_LENGTH, MAX_IMAGES } from '@/lib/text';
import { channelFeedPage, createPost, getPost, MAX_CURSOR } from '@/lib/posts';

/** チャンネルのタイムライン（グローバルと同じ FeedItem。リポスト込み・返信は含まない） */
export const GET = authed(async ({ req, params, viewer }) => {
  const channel = await requireChannel(intId(params.id), viewer.idNum);
  return channelFeedPage({ channelId: Number(channel.id), viewerId: viewer.idNum, cursor: cursorOf(req, MAX_CURSOR) });
});

/** チャンネルへの投稿（メンバーのみ）。POST /api/posts に channelId を付けるのと同じ */
export const POST = authed(async ({ req, params, viewer }) => {
  await rateLimit(`post:${viewer.idNum}`, 30, 60 * 1000, '投稿が多すぎます。少し待ってからお試しください');
  const channel = await requireChannel(intId(params.id), viewer.idNum);
  const body = await readJson(req);
  const content = str(body.content, '投稿', { max: MAX_CHANNEL_POST_LENGTH });
  const rawImages = body.images ?? [];
  if (!Array.isArray(rawImages) || rawImages.length > MAX_IMAGES) throw new HttpError(400, `画像は${MAX_IMAGES}枚までです`);
  const images = rawImages.map((u) => validateMediaUrl(u));
  if (!content && images.length === 0) throw new HttpError(400, '投稿の内容を入力してください');
  const id = await createPost({ userId: viewer.idNum, content, images, parentId: null, quoteOf: null, channelId: Number(channel.id) });
  return { post: await getPost(id, viewer.idNum) };
});
