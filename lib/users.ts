import 'server-only';
import { db } from './db';
import type { Profile, User, UserSummary } from '@/types/post';

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  avatar: string | null;
  verified: number;
  /** 選択中のフレーム画像の URL */
  avatar_decoration: string | null;
  /** user_badges を position 順に束ねた JSON（pg が配列にパースして返す） */
  badges: { id: number; shortcode: string; url: string }[] | null;
  is_bot?: boolean;
}

/** u（users）に対するユーザー情報の共通列。バッジ（カスタム絵文字・最大 5 個）は表示順の JSON 配列としてサブクエリで引く */
export const USER_COLS = `u.id, u.username, u.display_name, u.avatar, u.verified,
  (SELECT d.image FROM avatar_decorations d WHERE d.id = u.avatar_decoration_id) AS avatar_decoration,
  (SELECT jsonb_agg(jsonb_build_object('id', e.id, 'shortcode', e.shortcode, 'url', e.image) ORDER BY ub.position)
     FROM user_badges ub JOIN custom_emojis e ON e.id = ub.emoji_id WHERE ub.user_id = u.id) AS badges,
  EXISTS(SELECT 1 FROM bots bt WHERE bt.user_id = u.id) AS is_bot`;

export const toUser = (r: UserRow): User => ({
  id: String(r.id),
  username: r.username,
  name: r.display_name,
  avatarUrl: r.avatar,
  isVerified: !!r.verified,
  isBot: !!r.is_bot,
  avatarDecoration: r.avatar_decoration,
  badges: (r.badges ?? []).map((b) => ({ id: String(b.id), shortcode: b.shortcode, url: b.url })),
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
        (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id AND p.channel_id IS NULL AND p.parent_id IS NULL AND p.deleted_at IS NULL) AS posts_count
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
