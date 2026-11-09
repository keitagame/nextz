import 'server-only';
import { db, transaction } from './db';
import { HttpError } from './http';
import { toUser, USER_COLS, type UserRow } from './users';
import { MAX_CHANNELS_PER_USER } from './text';
import type { Channel, ChannelMember, Page } from '@/types/post';

export const CHANNEL_PAGE_SIZE = 20;

/** チャンネル内の投稿・返信・リアクションなどは posts テーブル（channel_id 付き）に入る。タイムラインは lib/posts.ts の channelFeedPage */

interface ChannelRow extends UserRow {
  cid: number;
  name: string;
  description: string;
  icon: string;
  owner_id: number;
  created_at: number;
  members: number;
  posts: number;
  last_post_at: number | null;
  is_member: boolean;
  is_banned: boolean;
}

/** u = 管理者（作成者）。USER_COLS は u に対する列 */
const CHANNEL_SELECT = `
  SELECT c.id AS cid, c.name, c.description, c.icon, c.owner_id, c.created_at, ${USER_COLS},
    (SELECT COUNT(*) FROM channel_members m WHERE m.channel_id = c.id) AS members,
    (SELECT COUNT(*) FROM posts p WHERE p.channel_id = c.id AND p.deleted_at IS NULL AND p.repost_of IS NULL) AS posts,
    (SELECT MAX(p.created_at) FROM posts p WHERE p.channel_id = c.id AND p.deleted_at IS NULL AND p.repost_of IS NULL) AS last_post_at,
    EXISTS(SELECT 1 FROM channel_members m WHERE m.channel_id = c.id AND m.user_id = @viewer) AS is_member,
    EXISTS(SELECT 1 FROM channel_bans b WHERE b.channel_id = c.id AND b.user_id = @viewer) AS is_banned
  FROM channels c JOIN users u ON u.id = c.owner_id`;

const toChannel = (r: ChannelRow, viewerId: number): Channel => ({
  id: String(r.cid),
  name: r.name,
  description: r.description,
  icon: r.icon,
  owner: toUser(r),
  membersCount: r.members,
  postsCount: r.posts,
  createdAt: new Date(r.created_at).toISOString(),
  lastPostAt: r.last_post_at ? new Date(r.last_post_at).toISOString() : null,
  isMember: r.is_member,
  isOwner: r.owner_id === viewerId,
  isBanned: r.is_banned,
});

export async function getChannel(id: number, viewerId: number): Promise<Channel | null> {
  const r = await db.get<ChannelRow>(`${CHANNEL_SELECT} WHERE c.id = @id`, { id, viewer: viewerId });
  return r ? toChannel(r, viewerId) : null;
}

export async function requireChannel(id: number, viewerId: number): Promise<Channel> {
  const c = await getChannel(id, viewerId);
  if (!c) throw new HttpError(404, 'チャンネルが見つかりません');
  return c;
}

/** 管理者（作成者）のみ許可 */
export async function requireOwner(id: number, viewerId: number): Promise<Channel> {
  const c = await requireChannel(id, viewerId);
  if (!c.isOwner) throw new HttpError(403, 'チャンネルの管理者のみ実行できます');
  return c;
}

export async function listChannels(opts: {
  viewerId: number;
  scope: 'all' | 'joined';
  q: string;
  offset: number;
}): Promise<Page<Channel>> {
  const where: string[] = [];
  const args: Record<string, unknown> = { viewer: opts.viewerId, lim: CHANNEL_PAGE_SIZE + 1, off: opts.offset };
  if (opts.scope === 'joined') where.push('EXISTS(SELECT 1 FROM channel_members m WHERE m.channel_id = c.id AND m.user_id = @viewer)');
  if (opts.q) {
    args.pat = `%${opts.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push(`(c.name ILIKE @pat ESCAPE '\\' OR c.description ILIKE @pat ESCAPE '\\')`);
  }
  const rows = await db.all<ChannelRow>(
    `${CHANNEL_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY COALESCE((SELECT MAX(p.created_at) FROM posts p WHERE p.channel_id = c.id AND p.deleted_at IS NULL AND p.repost_of IS NULL), c.created_at) DESC, c.id DESC
     LIMIT @lim OFFSET @off`,
    args as never,
  );
  const hasMore = rows.length > CHANNEL_PAGE_SIZE;
  return {
    items: rows.slice(0, CHANNEL_PAGE_SIZE).map((r) => toChannel(r, opts.viewerId)),
    nextCursor: hasMore ? String(opts.offset + CHANNEL_PAGE_SIZE) : null,
  };
}

export async function createChannel(input: { userId: number; name: string; description: string; icon: string }): Promise<number> {
  const owned = await db.get<{ c: number }>('SELECT COUNT(*) AS c FROM channels WHERE owner_id = ?', [input.userId]);
  if ((owned?.c ?? 0) >= MAX_CHANNELS_PER_USER) {
    throw new HttpError(400, `作成できるチャンネルは1人${MAX_CHANNELS_PER_USER}個までです。不要なチャンネルを削除してください`);
  }
  try {
    return await transaction(async (tx) => {
      const now = Date.now();
      const { lastId } = await tx.run(
        'INSERT INTO channels (name, description, icon, owner_id, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
        [input.name, input.description, input.icon, input.userId, now],
      );
      // 作成者は自動的にメンバーになる
      await tx.run('INSERT INTO channel_members (channel_id, user_id, joined_at) VALUES (?, ?, ?)', [lastId, input.userId, now]);
      return lastId;
    });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new HttpError(409, '同じ名前のチャンネルがすでにあります');
    throw e;
  }
}

/** チャンネルを削除する。メンバー・投稿・キック記録は ON DELETE CASCADE で一緒に消える */
export async function deleteChannel(id: number, viewerId: number) {
  await requireOwner(id, viewerId);
  await db.run('DELETE FROM channels WHERE id = ?', [id]);
}

export async function joinChannel(id: number, viewerId: number) {
  const c = await requireChannel(id, viewerId);
  if (c.isBanned) throw new HttpError(403, 'このチャンネルの管理者にキックされているため参加できません');
  await db.run('INSERT INTO channel_members (channel_id, user_id, joined_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [id, viewerId, Date.now()]);
}

export async function leaveChannel(id: number, viewerId: number) {
  const c = await requireChannel(id, viewerId);
  if (c.isOwner) throw new HttpError(400, '管理者はチャンネルから退出できません。不要な場合はチャンネルを削除してください');
  await db.run('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?', [id, viewerId]);
}

/** メンバーをキックする（管理者のみ）。キックされたユーザーは管理者が解除するまで再参加できない */
export async function kickMember(id: number, viewerId: number, targetId: number) {
  await requireOwner(id, viewerId);
  if (targetId === viewerId) throw new HttpError(400, '自分自身はキックできません');
  await transaction(async (tx) => {
    const r = await tx.run('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?', [id, targetId]);
    if (r.changes === 0) throw new HttpError(404, 'このユーザーはメンバーではありません');
    await tx.run('INSERT INTO channel_bans (channel_id, user_id, banned_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [id, targetId, Date.now()]);
  });
}

export async function unbanMember(id: number, viewerId: number, targetId: number) {
  await requireOwner(id, viewerId);
  await db.run('DELETE FROM channel_bans WHERE channel_id = ? AND user_id = ?', [id, targetId]);
}

export async function listMembers(channel: Channel): Promise<{ members: ChannelMember[]; banned: ChannelMember[] }> {
  const cid = Number(channel.id);
  const owner = Number(channel.owner.id);
  const members = await db.all<UserRow & { at: number }>(
    `SELECT ${USER_COLS}, m.joined_at AS at FROM channel_members m JOIN users u ON u.id = m.user_id
     WHERE m.channel_id = @ch ORDER BY (m.user_id = @owner) DESC, m.joined_at ASC, u.id ASC LIMIT 300`,
    { ch: cid, owner },
  );
  // キック済みユーザー一覧は管理者にだけ返す
  const banned = channel.isOwner
    ? await db.all<UserRow & { at: number }>(
        `SELECT ${USER_COLS}, b.banned_at AS at FROM channel_bans b JOIN users u ON u.id = b.user_id
         WHERE b.channel_id = @ch ORDER BY b.banned_at DESC LIMIT 100`,
        { ch: cid },
      )
    : [];
  const map = (r: UserRow & { at: number }): ChannelMember => ({ user: toUser(r), isOwner: r.id === owner, joinedAt: new Date(r.at).toISOString() });
  return { members: members.map(map), banned: banned.map(map) };
}
