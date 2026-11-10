/** サーバー・クライアント共通のテキスト処理 */

export const MAX_POST_LENGTH = 280;
export const MAX_DM_LENGTH = 1000;
/** チャンネル：投稿の文字数、チャンネル名・説明の上限 */
export const MAX_CHANNEL_POST_LENGTH = 500;
export const MAX_CHANNEL_NAME_LENGTH = 30;
export const MAX_CHANNEL_DESC_LENGTH = 200;
/** 1人が作成できるチャンネル数の上限 */
export const MAX_CHANNELS_PER_USER = 10;
export const MAX_IMAGES = 4;
/** 管理者がアカウントを凍結するときの理由の最大文字数 */
export const MAX_BAN_REASON_LENGTH = 500;
/** カスタム絵文字：ショートコード（`:name:` の name）の形式と、1ポストにつき1人が付けられるリアクション数の上限 */
export const SHORTCODE_RE = /^[A-Za-z0-9_]{2,32}$/;
export const MAX_REACTIONS_PER_POST = 10;

export const countChars = (s: string) => Array.from(s).length;

export const normalizeTag = (t: string) => t.normalize('NFKC').toLowerCase();

const TAG_SRC = String.raw`(?<![\p{L}\p{N}_&#/])#([\p{L}\p{N}_]{1,50})`;
const MENTION_SRC = String.raw`(?<![\p{L}\p{N}_@/])@([A-Za-z0-9_]{3,15})(?![A-Za-z0-9_])`;
// :shortcode: 。直前が英数字の場合（12:30:45 など）は絵文字として扱わない
const EMOJI_SRC = String.raw`(?<![A-Za-z0-9_]):([A-Za-z0-9_]{2,32}):`;
const URL_SRC = String.raw`https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+`;

export function extractTags(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(new RegExp(TAG_SRC, 'gu'))) set.add(normalizeTag(m[1]));
  return [...set];
}

export function extractMentions(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(new RegExp(MENTION_SRC, 'gu'))) set.add(m[1].toLowerCase());
  return [...set];
}

export type Token =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string }
  | { type: 'tag'; value: string; tag: string }
  | { type: 'mention'; value: string; username: string }
  | { type: 'emoji'; value: string; shortcode: string };

/** 本文を テキスト / URL / #タグ / @メンション / :絵文字: に分割する（HTML は一切生成しない） */
export function tokenize(text: string): Token[] {
  const re = new RegExp(`(${URL_SRC})|${TAG_SRC}|${MENTION_SRC}|${EMOJI_SRC}`, 'gu');
  const tokens: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) tokens.push({ type: 'text', value: text.slice(last, idx) });
    let matched = m[0];
    if (m[1]) {
      // URL 末尾の句読点は URL に含めない
      const trimmed = matched.replace(/[.,!?;:)\]]+$/, '');
      tokens.push({ type: 'url', value: trimmed });
      if (trimmed.length < matched.length) tokens.push({ type: 'text', value: matched.slice(trimmed.length) });
    } else if (m[2]) {
      tokens.push({ type: 'tag', value: matched, tag: m[2] });
    } else if (m[3]) {
      tokens.push({ type: 'mention', value: matched, username: m[3] });
    } else if (m[4]) {
      tokens.push({ type: 'emoji', value: matched, shortcode: m[4].toLowerCase() });
    }
    last = idx + matched.length;
    matched = '';
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  return tokens;
}

export const USERNAME_RE = /^[A-Za-z0-9_]{3,15}$/;

/** ルートと衝突するためユーザー名として使えない語 */
export const RESERVED_USERNAMES = new Set([
  'api', 'explore', 'notifications', 'messages', 'bookmarks', 'profile', 'settings',
  'posts', 'channels', 'timeline', 'login', 'signup', 'logout', 'home', 'search', 'hashtag', 'admin', 'static', 'next',
]);
