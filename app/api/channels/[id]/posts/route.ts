import { authed, cursorOf, HttpError, intId, readJson, str } from '@/lib/http';
import { channelPostsPage, createChannelPost, requireChannel } from '@/lib/channels';
import { rateLimit } from '@/lib/ratelimit';
import { validateMediaUrl } from '@/lib/media';
import { countChars, MAX_CHANNEL_POST_LENGTH, MAX_IMAGES } from '@/lib/text';
import { MAX_CURSOR } from '@/lib/posts';

export const GET = authed(async ({ req, params, viewer }) => {
  const channel = await requireChannel(intId(params.id), viewer.idNum);
  return channelPostsPage(channel, viewer.idNum, cursorOf(req, MAX_CURSOR));
});

export const POST = authed(async ({ req, params, viewer }) => {
  await rateLimit(`chpost:${viewer.idNum}`, 40, 60 * 1000, '投稿が多すぎます。少し待ってからお試しください');
  const channel = await requireChannel(intId(params.id), viewer.idNum);
  const body = await readJson(req);
  const content = str(body.content, '投稿', { max: MAX_CHANNEL_POST_LENGTH });
  if (countChars(content) > MAX_CHANNEL_POST_LENGTH) throw new HttpError(400, `投稿は${MAX_CHANNEL_POST_LENGTH}文字以内で入力してください`);
  const rawImages = body.images ?? [];
  if (!Array.isArray(rawImages) || rawImages.length > MAX_IMAGES) throw new HttpError(400, `画像は${MAX_IMAGES}枚までです`);
  const images = rawImages.map((u) => validateMediaUrl(u));
  if (!content && images.length === 0) throw new HttpError(400, '投稿の内容を入力してください');
  return { post: await createChannelPost({ channel, userId: viewer.idNum, content, images }) };
});
