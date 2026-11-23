/**
 * 画像の URL を Xserver 上の img.cgi 経由の URL に変換する（画像の代理配信）。
 * 変換するのはアップロード画像（Vercel Blob）だけ。それ以外（外部サイトの OGP 画像・data URL・開発用のローカル保存）はそのまま返す。
 * CGI の URL は NEXT_PUBLIC_IMG_PROXY で変更できる（https 必須。http だと混在コンテンツでブロックされる）。
 */
const PROXY = process.env.NEXT_PUBLIC_IMG_PROXY ?? 'https://keitter.xyz/img.cgi';
const BLOB_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/uploads\/[a-f0-9]{32}\.(?:jpg|png|gif|webp)$/;

export function proxyImg(url: string): string;
export function proxyImg(url: string | null | undefined): string | undefined;
export function proxyImg(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return BLOB_RE.test(url) ? `${PROXY}?u=${encodeURIComponent(url)}` : url;
}
