import 'server-only';
import crypto from 'node:crypto';
import { HttpError } from './http';

/**
 * OAuth 2.0（認可コードフロー + PKCE + state）。ライブラリは使わず fetch だけで実装している。
 * 有効になるのは、CLIENT_ID / CLIENT_SECRET の両方が環境変数に設定されているプロバイダーだけ。
 *   Google : GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 *   GitHub : GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
 * リダイレクト URI（各サービスの管理画面に登録する値）:
 *   {APP_URL}/api/auth/oauth/google/callback
 *   {APP_URL}/api/auth/oauth/github/callback
 *
 * プロバイダーを増やすには、PROVIDERS に 1 件足して fetchProfile を書くだけ。
 */
export interface OAuthProfile {
  /** プロバイダー側のユーザー ID（変わらない値） */
  id: string;
  email: string | null;
  /** プロバイダーがメールアドレスの所有を確認済みか。false / 不明なら、メールを根拠にした自動連携はしない */
  emailVerified: boolean;
  name: string;
  /** ユーザー名の候補（あとで整形して使う） */
  handle: string;
}

interface Provider {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  idEnv: string;
  secretEnv?: string;
  fetchProfile(accessToken: string): Promise<OAuthProfile>;
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

const PROVIDERS: Provider[] = [
  {
    id: 'google',
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    idEnv: 'GOOGLE_CLIENT_ID',
    secretEnv: 'GOOGLE_CLIENT_SECRET',
    async fetchProfile(at) {
      const u = await getJson<{ sub: string; email?: string; email_verified?: boolean; name?: string }>('https://openidconnect.googleapis.com/v1/userinfo', { Authorization: `Bearer ${at}` });
      return {
        id: String(u.sub),
        email: u.email?.toLowerCase() ?? null,
        emailVerified: u.email_verified === true,
        name: u.name ?? '',
        handle: (u.email ?? '').split('@')[0],
      };
    },
  },
  {
    id: 'github',
    name: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    idEnv: 'GITHUB_CLIENT_ID',
    secretEnv: 'GITHUB_CLIENT_SECRET',
    async fetchProfile(at) {
      const h = { Authorization: `Bearer ${at}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'nextz' };
      const u = await getJson<{ id: number; login: string; name?: string | null }>('https://api.github.com/user', h);
      // 公開設定に関わらず、確認済みのプライマリメールを取る
      const emails = await getJson<{ email: string; primary: boolean; verified: boolean }[]>('https://api.github.com/user/emails', h).catch(() => []);
      const best = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
      return { id: String(u.id), email: best?.email.toLowerCase() ?? null, emailVerified: !!best, name: u.name || u.login, handle: u.login };
    },
  },
  {
    id: 'karotter',
    name: 'Karotter',
    authUrl: 'https://karotter.com/api/oauth/authorize',
    tokenUrl: 'https://karotter.com/api/oauth/token',
    // Karotterの開発者設定（OAuthアプリ設定）で許可されたスコープに合わせて調整してください
    scope: 'profile',
    idEnv: 'KAROTTER_CLIENT_ID',
    secretEnv: 'KAROTTER_CLIENT_SECRET',
    async fetchProfile(at) {
      const h = { Authorization: `Bearer ${at}` };
      const res = await getJson<{
        sub?: string;
        id?: string | number;
        username?: string;
        preferred_username?: string;
        handle?: string;
        name?: string | null;
        display_name?: string | null;
        displayName?: string | null;
        email?: string | null;
        email_verified?: boolean;
        user?: {
          id?: string | number;
          username?: string;
          name?: string | null;
          display_name?: string | null;
          displayName?: string | null;
          email?: string | null;
          email_verified?: boolean;
        };
      }>('https://karotter.com/api/oauth/userinfo', h);

      // OIDC形式・フラットなUser形式・userオブジェクト内包形式のいずれにも対応
      const u = res.user ?? res;
      const userId = String(res.sub ?? u.id ?? '');
      const handle =
        u.username ?? res.preferred_username ?? res.handle ?? userId;
      const displayName =
        u.display_name ?? u.displayName ?? u.name ?? handle;
      const email = u.email ? u.email.toLowerCase() : null;

      return {
        id: userId,
        email,
        emailVerified: Boolean(u.email_verified ?? email),
        name: displayName,
        handle,
      };
    },
  },
    {
    // north（https://north.rip）。Authorization Code + PKCE(S256) の public client。メールアドレスは取得できない
    id: 'north',
    name: 'north',
    authUrl: 'https://api.north.rip/oauth/authorize',
    tokenUrl: 'https://api.north.rip/oauth/token',
    scope: 'users.read',
    idEnv: 'NORTH_CLIENT_ID',
    async fetchProfile(at) {
      const r = await getJson<{ data: { id: string; handle: string; name?: string | null } }>(
        'https://api.north.rip/2/users/me',
        { Authorization: `Bearer ${at}` },
      );
      const u = r.data;
      return { id: String(u.id), email: null, emailVerified: false, name: u.name || u.handle, handle: u.handle };
    },
  },
];

const isEnabled = (p: Provider) => !!process.env[p.idEnv] && (!p.secretEnv || !!process.env[p.secretEnv]);

export const providerById = (id: string): Provider | null => {
  const p = PROVIDERS.find((x) => x.id === id);
  return p && isEnabled(p) ? p : null;
};

export const enabledProviders = () => PROVIDERS.filter(isEnabled).map((p) => ({ id: p.id, name: p.name }));
export const providerName = (id: string) => PROVIDERS.find((p) => p.id === id)?.name ?? id;

export const redirectUri = (origin: string, provider: Provider) => `${origin}/api/auth/oauth/${provider.id}/callback`;

/** state / PKCE verifier を一時保存する httpOnly Cookie の名前 */
export const OAUTH_COOKIE = 'nextz_oauth';

const b64url = (b: Buffer) => b.toString('base64url');

/** 認可ページの URL と、コールバックで照合する state / PKCE verifier を作る */
export function buildAuthorizeUrl(provider: Provider, origin: string) {
  const state = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const url = new URL(provider.authUrl);
  url.search = new URLSearchParams({
    client_id: process.env[provider.idEnv]!,
    redirect_uri: redirectUri(origin, provider),
    response_type: 'code',
    scope: provider.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return { url: url.toString(), state, verifier };
}

/** 認可コードをアクセストークンに換え、プロフィールを取得する */
export async function fetchOAuthProfile(provider: Provider, code: string, verifier: string, origin: string): Promise<OAuthProfile> {
  try {
    const res = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(origin, provider),
        client_id: process.env[provider.idEnv]!,
        ...(provider.secretEnv ? { client_secret: process.env[provider.secretEnv]! } : {}),
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => null)) as { access_token?: string; error?: string } | null;
    if (!res.ok || !data?.access_token) throw new Error(`token → ${res.status} ${data?.error ?? ''}`);
    return await provider.fetchProfile(data.access_token);
  } catch (e) {
    console.error(`[oauth:${provider.id}]`, e);
    throw new HttpError(502, `${provider.name} との通信に失敗しました。もう一度お試しください`);
  }
}

/** プロバイダー側の名前・ID から、ユーザー名の初期候補を作る（半角英数字とアンダースコア・3〜15 文字） */
export function suggestUsername(handle: string): string {
  const s = handle.normalize('NFKC').replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 15);
  return s.length >= 3 ? s : '';
}
