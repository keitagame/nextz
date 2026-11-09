import { authed, cursorOf, readJson, str, HttpError } from '@/lib/http';
import { createChannel, getChannel, listChannels } from '@/lib/channels';
import { rateLimit } from '@/lib/ratelimit';
import { countChars, MAX_CHANNEL_DESC_LENGTH, MAX_CHANNEL_NAME_LENGTH } from '@/lib/text';

export const GET = authed(async ({ req, viewer }) => {
  const sp = req.nextUrl.searchParams;
  return listChannels({
    viewerId: viewer.idNum,
    scope: sp.get('scope') === 'joined' ? 'joined' : 'all',
    q: (sp.get('q') ?? '').trim().slice(0, 50),
    offset: cursorOf(req, 0),
  });
});

export const POST = authed(async ({ req, viewer }) => {
  await rateLimit(`channel:${viewer.idNum}`, 5, 60 * 60 * 1000, 'チャンネルの作成が多すぎます。しばらくしてからお試しください');
  const body = await readJson(req);
  const name = str(body.name, 'チャンネル名', { min: 1, max: MAX_CHANNEL_NAME_LENGTH }).replace(/\s+/g, ' ');
  const description = str(body.description, '説明', { max: MAX_CHANNEL_DESC_LENGTH });
  // アイコンは絵文字 1 つ分（結合文字を含めても 8 文字まで）
  const icon = str(body.icon, 'アイコン', { max: 8 });
  if (icon && countChars(icon) > 8) throw new HttpError(400, 'アイコンが正しくありません');
  const id = await createChannel({ userId: viewer.idNum, name, description, icon });
  return { channel: await getChannel(id, viewer.idNum) };
});
