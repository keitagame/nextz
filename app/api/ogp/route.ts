import { open, clientIp, HttpError } from '@/lib/http';
import { fetchLinkPreview, parsePublicUrl } from '@/lib/ogp';
import { rateLimit } from '@/lib/ratelimit';
import { baseUrl } from '@/lib/url';

/** タイムラインのリンクカード用。URL の OGP を返す（取得できなければ preview: null） */
export const GET = open(async ({ req }) => {
  const raw = req.nextUrl.searchParams.get('url') ?? '';
  if (!parsePublicUrl(raw)) throw new HttpError(400, 'URL が正しくありません');
  // CDN キャッシュに当たらなかった（= 実際に外部へ取りに行く）リクエストだけが対象
  await rateLimit(`ogp:${clientIp(req)}`, 60, 60 * 1000, 'リンクの読み込みが多すぎます。少し待ってからお試しください');

  const preview = await fetchLinkPreview(raw, `Mozilla/5.0 (compatible; ZLinkPreview/1.0; +${baseUrl(req)})`);
  // 閲覧者に依存しないレスポンスなので共有キャッシュしてよい。取得失敗は短めに保持して再試行できるようにする
  return Response.json(
    { preview },
    { headers: { 'Cache-Control': preview ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' : 'public, max-age=300, s-maxage=600' } },
  );
});
