import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from './db';
import { HttpError } from './http';

/**
 * Vercel の関数はリクエストボディが 4.5MB まで。マルチパートの余白を見て 4MB を上限にする。
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** カスタム絵文字の画像サイズ上限 */
export const MAX_EMOJI_BYTES = 512 * 1024;
export const MEDIA_NAME_RE = /^[a-f0-9]{32}\.(jpg|png|gif|webp)$/;

export const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

/**
 * IMG_UPLOAD_URL（img.cgi の URL）と IMG_UPLOAD_KEY（共有の合言葉）、IMG_PUBLIC_BASE（画像の公開URLの先頭。例: https://xs038402.xsrv.jp/uploads）を
 * 設定すると、画像を Xserver に保存する。未設定ならローカルディスク（開発用）に保存する。
 */
const UP_URL = () => process.env.IMG_UPLOAD_URL ?? '';
const UP_KEY = () => process.env.IMG_UPLOAD_KEY ?? '';
const PUBLIC_BASE = () => (process.env.IMG_PUBLIC_BASE ?? '').replace(/\/+$/, '');
const useRemote = () => !!(UP_URL() && UP_KEY() && PUBLIC_BASE());

/** マジックナンバーで画像形式を判定（拡張子や Content-Type は信用しない。SVG は XSS 防止のため不許可） */
export function sniffImage(buf: Buffer): 'jpg' | 'png' | 'gif' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'GIF8') return 'gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

export function mediaPath(name: string) {
  return path.join(UPLOAD_DIR, name);
}

/** 画像を保存して、投稿やプロフィールに保存する URL を返す */
export async function saveImage(buf: Buffer, ext: 'jpg' | 'png' | 'gif' | 'webp'): Promise<string> {
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  if (useRemote()) {
    const res = await fetch(UP_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: UP_KEY(), name, data: buf.toString('base64') }),
    }).catch(() => null);
    if (!res || !res.ok) throw new HttpError(502, '画像の保存に失敗しました');
    return `${PUBLIC_BASE()}/${name}`;
  }
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(mediaPath(name), buf);
  return `/api/media/${name}`;
}

/** 自サービスがアップロードした画像の URL か検証して返す */
export function validateMediaUrl(url: unknown, label = '画像'): string {
  const bad = () => new HttpError(400, `${label}が正しくありません`);
  if (typeof url !== 'string') throw bad();

  // ローカル保存（開発用）
  const m = /^\/api\/media\/([a-f0-9]{32}\.(?:jpg|png|gif|webp))$/.exec(url);
  if (m) {
    if (useRemote() || !fs.existsSync(mediaPath(m[1]))) throw bad();
    return url;
  }

  // Xserver（IMG_PUBLIC_BASE 配下のランダム名のみ許可）
  if (useRemote()) {
    const prefix = `${PUBLIC_BASE()}/`;
    if (url.startsWith(prefix) && MEDIA_NAME_RE.test(url.slice(prefix.length))) return url;
  }
  throw bad();
}
