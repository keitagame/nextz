import { open, readJson, viewerIdOf, intId, clientIp, HttpError } from '@/lib/http';
import { addImpressions, MAX_IMPRESSION_BATCH } from '@/lib/posts';
import { rateLimit } from '@/lib/ratelimit';

/** 1 分あたりに送れる回数（クライアントは数秒ごとにまとめて送るので、通常は十分に余る） */
const RATE_PER_MIN = 30;

/** 画面に表示されたポストの ID をまとめて受け取り、インプレッションを加算する（ゲストも可） */
export const POST = open(async ({ req, viewer }) => {
  const body = await readJson(req);
  if (!Array.isArray(body.ids)) throw new HttpError(400, 'リクエストの形式が正しくありません');
  if (body.ids.length > MAX_IMPRESSION_BATCH) throw new HttpError(400, `一度に送れるのは${MAX_IMPRESSION_BATCH}件までです`);
  const ids = body.ids.map((v) => intId(v));
  await rateLimit(`imp:${viewer ? `u${viewer.idNum}` : clientIp(req)}`, RATE_PER_MIN, 60 * 1000);
  await addImpressions(ids, viewerIdOf(viewer));
  return { ok: true };
});
