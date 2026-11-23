import { HttpError } from './http';

/** メールアドレスの検証と正規化（前後の空白を除き、小文字にする） */
export function parseEmail(v: unknown): string {
  if (typeof v !== 'string') throw new HttpError(400, 'メールアドレスが正しくありません');
  const e = v.trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, 'メールアドレスの形式が正しくありません');
  return e;
}
