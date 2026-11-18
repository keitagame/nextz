import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { createSession, getViewer, isSecureRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { clientIp, HttpError } from '@/lib/http';
import { fetchOAuthProfile, OAUTH_COOKIE, providerById, type OAuthProfile } from '@/lib/oauth';
import { setPending } from '@/lib/pending';
import { rateLimit } from '@/lib/ratelimit';
import { baseUrl } from '@/lib/url';

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

interface OAuthCookie {
  provider: string;
  state: string;
  verifier: string;
  mode: 'login' | 'link';
  userId: number | null;
}

/**
 * 外部サービスから戻ってくる URL。
 *  - すでに連携済みのアカウント            → ログイン
 *  - ログイン中の「連携を追加」             → 連携を保存して設定画面へ
 *  - 未連携で、確認済みメールが既存アカウントと一致 → 連携してログイン
 *  - それ以外                              → ユーザー名と利用規約の入力画面（新規登録）へ
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: pid } = await ctx.params;
  const origin = baseUrl(req);
  const secure = isSecureRequest(req);
  const go = (path: string) => NextResponse.redirect(`${origin}${path}`);

  const jar = await cookies();
  let saved: OAuthCookie | null = null;
  try {
    saved = JSON.parse(Buffer.from(jar.get(OAUTH_COOKIE)?.value ?? '', 'base64url').toString());
  } catch {}
  jar.delete(OAUTH_COOKIE); // state は 1 回しか使わせない

  const failTo = (msg: string) => go(`${saved?.mode === 'link' ? '/settings' : '/login'}?oauth_error=${encodeURIComponent(msg)}`);

  try {
    const provider = providerById(pid);
    if (!provider) return failTo('このログイン方法は現在使えません');
    const q = req.nextUrl.searchParams;
    if (q.get('error')) return failTo('ログインがキャンセルされました');
    const code = q.get('code');
    const state = q.get('state');
    if (!saved || saved.provider !== pid || !code || !state || !safeEqual(state, saved.state)) {
      return failTo('ログインの有効期限が切れました。もう一度お試しください');
    }
    await rateLimit(`oauth-cb:${clientIp(req)}`, 30, 10 * 60 * 1000);

    const profile = await fetchOAuthProfile(provider, code, saved.verifier, origin);
    const now = Date.now();

    const loginAs = async (userId: number) => {
      const u = await db.get<{ banned_at: number | null }>('SELECT banned_at FROM users WHERE id = ?', [userId]);
      if (!u) return failTo('アカウントが見つかりません');
      if (u.banned_at) return failTo('このアカウントは利用規約違反のため凍結されています');
      await createSession(userId, secure);
      return go('/');
    };

    const linked = await db.get<{ user_id: number }>('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?', [pid, profile.id]);

    // ---- 連携の追加（ログイン中） ----
    if (saved.mode === 'link') {
      const viewer = await getViewer();
      if (!viewer || viewer.idNum !== saved.userId) return failTo('ログインが必要です');
      if (linked && linked.user_id !== viewer.idNum) return failTo(`この ${provider.name} アカウントは別のユーザーに連携されています`);
      if (!linked) {
        // 1 ユーザーにつき同じサービスは 1 アカウントまで（設定画面が 1 サービス 1 行のため）
        if (await db.get('SELECT 1 FROM oauth_accounts WHERE user_id = ? AND provider = ?', [viewer.idNum, pid])) {
          return failTo(`すでに別の ${provider.name} アカウントが連携されています。先に解除してください`);
        }
        await insertLink(viewer.idNum, pid, profile, now);
      }
      return go(`/settings?linked=${encodeURIComponent(pid)}`);
    }

    // ---- ログイン / 新規登録 ----
    if (linked) return await loginAs(linked.user_id);

    // 外部サービス側で確認済みのメールアドレスが、確認済みの既存アカウントと同じなら、その持ち主とみなして連携する
    if (profile.email && profile.emailVerified) {
      const same = await db.get<{ id: number }>('SELECT id FROM users WHERE lower(email) = ? AND email_verified_at IS NOT NULL', [profile.email]);
      if (same) {
        await insertLink(same.id, pid, profile, now);
        return await loginAs(same.id);
      }
    }

    await setPending('oauth_signup', null, { provider: pid, sub: profile.id, email: profile.emailVerified ? profile.email : null, name: profile.name, handle: profile.handle }, 15 * 60 * 1000, secure);
    return go('/login');
  } catch (e) {
    if (e instanceof HttpError) return failTo(e.message);
    console.error('[oauth callback]', e);
    return failTo('サーバーエラーが発生しました');
  }
}

/** 連携を保存する。そのユーザーがすでに同じサービスを連携していたら何もしない（1 ユーザー 1 サービス 1 アカウント） */
async function insertLink(userId: number, provider: string, p: OAuthProfile, now: number) {
  await db.run(
    `INSERT INTO oauth_accounts (provider, provider_user_id, user_id, email, created_at)
     SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM oauth_accounts WHERE user_id = ? AND provider = ?)
     ON CONFLICT DO NOTHING`,
    [provider, p.id, userId, p.email, now, userId, provider],
  );
}
