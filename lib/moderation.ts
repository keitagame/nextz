import 'server-only';
import { db } from './db';
import { isAdminUsername } from './admin';
import type { AdminUser } from '@/types/post';

export interface AdminUserRow {
  id: number;
  username: string;
  display_name: string;
  avatar: string | null;
  is_bot: boolean;
  created_at: number;
  terms_version: string | null;
  banned_at: number | null;
  ban_reason: string;
  banned_by_name: string | null;
}

/** 管理画面で使うユーザー情報の共通列（users = u） */
export const ADMIN_USER_COLS = `u.id, u.username, u.display_name, u.avatar, u.created_at, u.terms_version, u.banned_at, u.ban_reason,
  EXISTS(SELECT 1 FROM bots bt WHERE bt.user_id = u.id) AS is_bot,
  (SELECT a.username FROM users a WHERE a.id = u.banned_by) AS banned_by_name`;

export const toAdminUser = (r: AdminUserRow): AdminUser => ({
  id: String(r.id),
  username: r.username,
  name: r.display_name,
  avatarUrl: r.avatar,
  isBot: !!r.is_bot,
  isAdmin: isAdminUsername(r.username),
  createdAt: new Date(r.created_at).toISOString(),
  termsVersion: r.terms_version,
  bannedAt: r.banned_at ? new Date(r.banned_at).toISOString() : null,
  banReason: r.ban_reason,
  bannedBy: r.banned_by_name,
});

export async function getAdminUser(username: string): Promise<AdminUser | null> {
  const r = await db.get<AdminUserRow>(`SELECT ${ADMIN_USER_COLS} FROM users u WHERE lower(u.username) = lower(?)`, [username]);
  return r ? toAdminUser(r) : null;
}
