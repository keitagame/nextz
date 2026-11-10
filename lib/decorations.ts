/**
 * アイコンデコレーション（アイコンの周りに付く装飾リング）。
 * 見た目は app/globals.css の `[data-decoration="<id>"]` で定義している（画像アセット不要）。
 * サーバー（検証）とクライアント（ピッカー）の両方から使うので 'server-only' は付けない。
 */
export interface Decoration {
  id: string;
  label: string;
  /** ピッカーのプレビュー用 CSS background（globals.css の --deco-bg と同じ値） */
  preview: string;
  animated?: boolean;
}

export const DECORATIONS: Decoration[] = [
  { id: 'rainbow', label: 'レインボー', animated: true, preview: 'conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e)' },
  { id: 'sunset', label: 'サンセット', preview: 'linear-gradient(135deg, #fb923c, #f43f5e, #a855f7)' },
  { id: 'ocean', label: 'オーシャン', preview: 'linear-gradient(135deg, #22d3ee, #3b82f6, #4338ca)' },
  { id: 'forest', label: 'フォレスト', preview: 'linear-gradient(135deg, #a3e635, #22c55e, #0f766e)' },
  { id: 'sakura', label: 'さくら', preview: 'linear-gradient(135deg, #fbcfe8, #f472b6, #fda4af)' },
  { id: 'gold', label: 'ゴールド', preview: 'conic-gradient(#fde68a, #f59e0b, #fef3c7, #d97706, #fde68a)' },
  { id: 'galaxy', label: 'ギャラクシー', animated: true, preview: 'conic-gradient(#312e81, #7c3aed, #ec4899, #38bdf8, #312e81)' },
  { id: 'dashed', label: 'ドット', animated: true, preview: 'repeating-conic-gradient(var(--primary) 0 12deg, transparent 12deg 24deg)' },
];

const IDS = new Set(DECORATIONS.map((d) => d.id));

export const isDecorationId = (v: unknown): v is string => typeof v === 'string' && IDS.has(v);

/** 1 人が付けられるバッジの上限 */
export const MAX_BADGES = 5;
