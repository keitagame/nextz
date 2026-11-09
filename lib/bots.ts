import 'server-only';
import { db } from './db';
import { HttpError, intId } from './http';
import type { Bot } from '@/types/post';

/** 1人が作成できるボット数の上限 */
export const MAX_BOTS_PER_USER = 5;

interface BotRow {
  id: number;
  username: string;
  display_name: string;
  avatar: string | null;
  token_prefix: string;
  created_at: number;
  last_used_at: number | null;
}

export const BOT_COLS = `u.id, u.username, u.display_name, u.avatar, b.token_prefix, b.created_at, b.last_used_at`;

export const toBot = (r: BotRow): Bot => ({
  id: String(r.id),
  username: r.username,
  name: r.display_name,
  avatarUrl: r.avatar,
  tokenPrefix: r.token_prefix,
  createdAt: new Date(r.created_at).toISOString(),
  lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
});

export async function getBot(botId: number): Promise<Bot | null> {
  const r = await db.get<BotRow>(`SELECT ${BOT_COLS} FROM bots b JOIN users u ON u.id = b.user_id WHERE b.user_id = ?`, [botId]);
  return r ? toBot(r) : null;
}

/** 自分が所有するボットの ID を検証して返す（他人のボットは 404） */
export async function ownedBotId(raw: unknown, ownerId: number): Promise<number> {
  const id = intId(raw, 'ボットID');
  if (!(await db.get('SELECT 1 AS ok FROM bots WHERE user_id = ? AND owner_id = ?', [id, ownerId]))) {
    throw new HttpError(404, 'ボットが見つかりません');
  }
  return id;
}
