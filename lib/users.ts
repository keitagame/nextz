import 'server-only';
import { db } from './db';
import type { Profile, User, UserSummary } from '@/types/post';

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  avatar: string | null;
  verified: number;
  badge_id: number | null;
  badge_code: string | null;
  badge_url: string | null;
  is_bot?: boolean;
}

/** u（users）に対するユーザー情報の共通列。バッジ（カスタム絵文字）はサブクエリで引く */
export const USER_COLS = `u.id, u.username, u.display_name, u.avatar, u.verified, u.badge_emoji_id AS badge_id,
  (SELECT e.shortcode FROM custom_emojis e WHERE e.id = u.badge_emoji_id) AS badge_code,
  (SELECT e.image FROM custom_emojis e WHERE e.id = u.badge_emoji_id) AS badge_url,
  EXISTS(SELECT 1 FROM bots bt WHERE bt.user_id = u.id) AS is_bot`;

export const toUser = (r: UserRow): User => ({
  id: String(r.id),
  username: r.username,
  name: r.display_name,
  avatarUrl: r.avatar,
  isVerified: !!r.verified,
  isBot: !!r.is_bot,
  badge: r.badge_id && r.badge_code && r.badge_url ? { id: String(r.badge_id), shortcode: r.badge_code, url: r.badge_url } : null,
});

export async function getUserById(id: number): Promise<User | null> {
  const r = await db.get<UserRow>(`SELECT ${USER_COLS} FROM users u WHERE u.id = ?`, [id]);
  return r ? toUser(r) : null;
}

export async function getUserIdByName(username: string): Promise<number | null> {
  const r = await db.get<{ id: number }>('SELECT id FROM users WHERE lower(username) = lower(?)', [username]);
  return r?.id ?? null;
}

type SummaryRow = UserRow & { bio: string; is_following: number; follows_you: number };

export const SUMMARY_COLS = `${USER_COLS}, u.bio,
  EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = @viewer AND f.followee_id = u.id) AS is_following,
  EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followee_id = @viewer) AS follows_you`;

export const toSummary = (r: SummaryRow): UserSummary => ({
  ...toUser(r),
  bio: r.bio,
  isFollowing: !!r.is_following,
  followsYou: !!r.follows_you,
});

export async function getProfile(username: string, viewerId: number): Promise<Profile | null> {
  const r = await db.get<
    SummaryRow & { banner: string | null; location: string; website: string; created_at: number; followers: number; following: number; posts_count: number }
  >(
    `SELECT ${SUMMARY_COLS}, u.banner, u.location, u.website, u.created_at,
        (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS followers,
        (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id) AS following,
        (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.parent_id IS NULL AND p.deleted_at IS NULL) AS posts_count
       FROM users u WHERE lower(u.username) = lower(@name)`,
    { viewer: viewerId, name: username },
  );
  if (!r) return null;
  return {
    ...toSummary(r),
    bannerUrl: r.banner,
    location: r.location,
    website: r.website,
    createdAt: new Date(r.created_at).toISOString(),
    followersCount: r.followers,
    followingCount: r.following,
    postsCount: r.posts_count,
    isMe: r.id === viewerId,
  };
}

/** 検索・フォロー一覧などの共通ページング（offset ベース） */
export function pageOfUsers(rows: SummaryRow[], limit: number, offset: number) {
  const hasMore = rows.length > limit;
  return {
    items: rows.slice(0, limit).map(toSummary),
    nextCursor: hasMore ? String(offset + limit) : null,
  };
}
