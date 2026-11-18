/** プロフィール装飾まわりの定数（サーバー・クライアント共用） */

/** 1 人が付けられるバッジの上限 */
export const MAX_BADGES = 5;

/**
 * アイコンデコレーション（フレーム画像）の規約。
 * 画像は正方形で、中央をアイコンの大きさに合わせて透過させる。
 * 画像全体はアイコンの DECORATION_SCALE 倍で重ねて表示する（= アイコンは画像の中央 約 83% に収まる）。
 */
export const DECORATION_SCALE = 1.2;
export const MAX_DECORATION_BYTES = 1024 * 1024;
export const MAX_DECORATIONS = 500;
