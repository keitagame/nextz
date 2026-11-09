import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { put } from '@vercel/blob';
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

/** BLOB_READ_WRITE_TOKEN があれば Vercel Blob、なければローカルディスク（開発用）に保存する */
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

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
  if (useBlob()) {
    const blob = await put(`uploads/${name}`, buf, {
      access: 'public',
      contentType: MIME[ext],
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return blob.url;
  }
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(mediaPath(name), buf);
  return `/api/media/${name}`;
}

const BLOB_URL_RE = /^\/uploads\/[a-f0-9]{32}\.(?:jpg|png|gif|webp)$/;

/** 自サービスがアップロードした画像の URL か検証して返す */
export function validateMediaUrl(url: unknown, label = '画像'): string {
  const bad = () => new HttpError(400, `${label}が正しくありません`);
  if (typeof url !== 'string') throw bad();

  // ローカル保存（開発用）
  const m = /^\/api\/media\/([a-f0-9]{32}\.(?:jpg|png|gif|webp))$/.exec(url);
  if (m) {
    if (useBlob() || !fs.existsSync(mediaPath(m[1]))) throw bad();
    return url;
  }

  // Vercel Blob（公開ストアのドメイン + uploads/ 配下のランダム名のみ許可）
  if (useBlob()) {
    try {
      const u = new URL(url);
      if (u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com') && BLOB_URL_RE.test(u.pathname) && !u.search && !u.hash) {
        return url;
      }
    } catch {
      /* fallthrough */
    }
  }
  throw bad();
}
