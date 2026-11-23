import { authed, HttpError } from '@/lib/http';
import { MAX_DECORATION_BYTES } from '@/lib/decorations';
import { MAX_EMOJI_BYTES, MAX_UPLOAD_BYTES, saveImage, sniffImage } from '@/lib/media';
import { rateLimit } from '@/lib/ratelimit';

export const POST = authed(async ({ req, viewer }) => {
  await rateLimit(`upload:${viewer.idNum}`, 40, 10 * 60 * 1000);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, 'アップロードの形式が正しくありません');
  }
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'ファイルが選択されていません');
  // カスタム絵文字・デコレーション用は小さいサイズに制限する
  const kind = form.get('kind');
  if (kind === 'decoration') {
    if (file.size > MAX_DECORATION_BYTES) throw new HttpError(413, `デコレーションの画像は${MAX_DECORATION_BYTES / 1024}KB以下にしてください`);
  } else if (kind === 'emoji') {
    if (file.size > MAX_EMOJI_BYTES) throw new HttpError(413, `絵文字の画像は${MAX_EMOJI_BYTES / 1024}KB以下にしてください`);
  } else if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, `画像のサイズは${MAX_UPLOAD_BYTES / 1024 / 1024}MB以下にしてください`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffImage(buf);
  if (!ext) throw new HttpError(400, 'JPEG / PNG / GIF / WebP の画像のみアップロードできます');
  // フレーム画像は中央を透過させる必要があるので、透過に対応しない JPEG は不可
  if (kind === 'decoration' && ext === 'jpg') throw new HttpError(400, 'デコレーションには透過に対応した PNG / GIF / WebP を使ってください');
  return { url: await saveImage(buf, ext) };
});
