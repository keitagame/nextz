import 'server-only';

/**
 * メール内のリンクや OAuth のリダイレクト URI に使う、このアプリの公開 URL（末尾スラッシュなし）。
 * Host ヘッダーはリクエストごとに偽装できるため、本番では環境変数を優先する。
 *   1. APP_URL（例: https://z.example.com）  ← 本番では必ず設定してください
 *   2. Vercel の本番ドメイン（VERCEL_PROJECT_PRODUCTION_URL）
 *   3. リクエストのホスト（ローカル開発用）
 */
export function baseUrl(req: Request): string {
  const env = process.env.APP_URL?.trim();
  if (env) return env.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  const u = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || u.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host') || u.host;
  return `${proto}://${host}`;
}

/**
 * リクエストが無い場面（metadataBase など）で使う、このアプリの公開 URL（末尾スラッシュなし）。
 * OGP の画像・URL を絶対 URL にするために使う。APP_URL → Vercel の本番ドメイン → ローカル の順。
 */
export function siteUrl(): string {
  const env = process.env.APP_URL?.trim();
  if (env) return env.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return 'http://localhost:3000';
}
