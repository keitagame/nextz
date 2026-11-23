import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getViewer, isSecureRequest } from '@/lib/auth';
import { clientIp, HttpError } from '@/lib/http';
import { buildAuthorizeUrl, OAUTH_COOKIE, providerById } from '@/lib/oauth';
import { rateLimit } from '@/lib/ratelimit';
import { baseUrl } from '@/lib/url';

/**
 * 外部サービスの認可ページへ移動する。
 *   /api/auth/oauth/google/start               ログイン / 新規登録
 *   /api/auth/oauth/google/start?mode=link     ログイン中のアカウントに連携を追加（設定画面から）
 * state と PKCE の verifier は httpOnly Cookie に保存し、コールバックで照合する。
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: pid } = await ctx.params;
  const origin = baseUrl(req);
  const mode = req.nextUrl.searchParams.get('mode') === 'link' ? 'link' : 'login';
  const back = (msg: string) => NextResponse.redirect(`${origin}${mode === 'link' ? '/settings' : '/login'}?oauth_error=${encodeURIComponent(msg)}`);

  try {
    const provider = providerById(pid);
    if (!provider) return back('このログイン方法は現在使えません');
    await rateLimit(`oauth-start:${clientIp(req)}`, 30, 10 * 60 * 1000);

    let userId: number | null = null;
    if (mode === 'link') {
      // 他サイトのリンクから勝手に連携を始められないよう、同一サイトからの移動だけ受け付ける
      const site = req.headers.get('sec-fetch-site');
      if (site && site !== 'same-origin' && site !== 'none') return back('不正なリクエストです');
      const viewer = await getViewer();
      if (!viewer) return back('ログインが必要です');
      userId = viewer.idNum;
    }

    const { url, state, verifier } = buildAuthorizeUrl(provider, origin);
    const value = Buffer.from(JSON.stringify({ provider: pid, state, verifier, mode, userId })).toString('base64url');
    (await cookies()).set(OAUTH_COOKIE, value, { httpOnly: true, sameSite: 'lax', secure: isSecureRequest(req), path: '/', maxAge: 10 * 60 });
    return NextResponse.redirect(url);
  } catch (e) {
    if (e instanceof HttpError) return back(e.message);
    console.error('[oauth start]', e);
    return back('サーバーエラーが発生しました');
  }
}
