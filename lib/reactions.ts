import type { EmojiRef, Reaction } from '@/types/post';

/** リアクション一覧に対して、自分のリアクションを付ける/外した結果を返す（楽観的更新用の純粋関数） */
export function withReaction(list: Reaction[], emoji: EmojiRef, on: boolean): Reaction[] {
  const i = list.findIndex((r) => r.id === emoji.id);
  if (on) {
    if (i < 0) return [...list, { id: emoji.id, shortcode: emoji.shortcode, url: emoji.url, count: 1, reacted: true }];
    if (list[i].reacted) return list;
    return list.map((r, j) => (j === i ? { ...r, count: r.count + 1, reacted: true } : r));
  }
  if (i < 0 || !list[i].reacted) return list;
  const count = list[i].count - 1;
  return count <= 0 ? list.filter((_, j) => j !== i) : list.map((r, j) => (j === i ? { ...r, count, reacted: false } : r));
}
