/**
 * SNS の背景画像（クライアント専用）。
 * アップロードした画像はブラウザ内で小さく縮小し、そのサムネイル（数KB〜数十KB）だけを localStorage に保存する。
 * 表示時に CSS で強くぼかす（globals.css の html.has-bg）。元の画像はサーバーにも端末にも残らず、縮小済みなので細部は復元できない。表示テーマ（theme）と同じく端末ごとの設定。
 */

const KEY = 'bg-image';

/** 保存する縮小画像の長辺(px)。小さいほど細部が失われ、保存サイズも小さい。ぼかしの強さは globals.css の blur() */
export const BG_MAX_SIDE = 160;
/** 読み込む元画像のサイズ上限 */
export const MAX_BG_INPUT_BYTES = 20 * 1024 * 1024;

const DATA_URL_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

export function getStoredBackground(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && DATA_URL_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** <html> に背景画像を反映する（null で解除）。見た目は globals.css の html.has-bg が担当 */
export function applyBackground(dataUrl: string | null) {
  const root = document.documentElement;
  if (dataUrl && DATA_URL_RE.test(dataUrl)) {
    root.style.setProperty('--app-bg-image', `url("${dataUrl}")`);
    root.classList.add('has-bg');
  } else {
    root.style.removeProperty('--app-bg-image');
    root.classList.remove('has-bg');
  }
}

export function saveBackground(dataUrl: string) {
  localStorage.setItem(KEY, dataUrl);
  applyBackground(dataUrl);
}

export function clearBackground() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  applyBackground(null);
}

/** 画像ファイルを小さく縮小した JPEG（ぼかし表示用）に変換して data URL で返す。 */
export async function shrinkForBackground(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選んでください');
  if (file.size > MAX_BG_INPUT_BYTES) throw new Error(`画像のサイズは${MAX_BG_INPUT_BYTES / 1024 / 1024}MB以下にしてください`);

  let bitmap: ImageBitmap;
  try {
    // EXIF の向きは既定で反映される。GIF は最初のフレームになる
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('この画像は読み込めませんでした');
  }

  try {
    const scale = BG_MAX_SIDE / Math.max(bitmap.width, bitmap.height);
    const cw = Math.max(1, Math.round(bitmap.width * Math.min(1, scale)));
    const ch = Math.max(1, Math.round(bitmap.height * Math.min(1, scale)));

    // 一気に縮めると間引かれてノイズっぽくなるので、半分ずつ縮める
    let cur: CanvasImageSource = bitmap;
    let w = bitmap.width;
    let h = bitmap.height;
    while (w > cw * 2 || h > ch * 2) {
      const nw = Math.max(cw, Math.ceil(w / 2));
      const nh = Math.max(ch, Math.ceil(h / 2));
      const c = document.createElement('canvas');
      c.width = nw;
      c.height = nh;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(cur, 0, 0, nw, nh);
      cur = c;
      w = nw;
      h = nh;
    }

    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const octx = out.getContext('2d');
    if (!octx) throw new Error('canvas');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(cur, 0, 0, cw, ch);
    return out.toDataURL('image/jpeg', 0.8);
  } catch {
    throw new Error('画像の変換に失敗しました');
  } finally {
    bitmap.close();
  }
}
