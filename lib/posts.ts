import 'server-only';
import { db, transaction } from './db';
import { HttpError } from './http';
import { notify } from './notify';
import { toUser, USER_COLS, type UserRow } from './users';
import { extractMentions, extractTags } from './text';
import type { FeedItem, Page, Post, Reaction } from '@/types/post';

interface PostRow extends UserRow {
  pid: number;
  user_id: number;
  content: string;
  images: string;
  parent_id: number | null;
  quote_of: number | null;
  deleted_at: number | null;
  created_at: number;
  reply_to: string | null;
  replies: number;
  likes: number;
  reposts: number;
  quotes: number;
  bookmarks: number;
  liked: number;
  reposted: number;
  bookmarked: number;
}

const POST_SELECT = `
  SELECT p.id AS pid, p.user_id, p.content, p.images, p.parent_id, p.quote_of, p.deleted_at, p.created_at,
    ${USER_COLS}, pu.username AS reply_to,
    (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id AND r.deleted_at IS NULL) AS replies,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes,
    (SELECT COUNT(*) FROM posts r WHERE r.repost_of = p.id) AS reposts,
    (SELECT COUNT(*) FROM posts q WHERE q.quote_of = p.id AND q.deleted_at IS NULL) AS quotes,
    (SELECT COUNT(*) FROM bookmarks b WHERE b.post_id = p.id) AS bookmarks,
    EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = @viewer) AS liked,
    EXISTS(SELECT 1 FROM posts r WHERE r.repost_of = p.id AND r.user_id = @viewer) AS reposted,
    EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = @viewer) AS bookmarked
  FROM posts p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN posts pp ON pp.id = p.parent_id
  LEFT JOIN users pu ON pu.id = pp.user_id`;

function toPost(r: PostRow, quote: Post | null, reactions: Reaction[]): Post {
  const deleted = !!r.deleted_at;
  return {
    id: String(r.pid),
    author: toUser(r),
    content: deleted ? '' : r.content,
    images: deleted ? [] : (JSON.parse(r.images) as string[]),
    createdAt: new Date(r.created_at).toISOString(),
    parentId: r.parent_id ? String(r.parent_id) : null,
    replyToUsername: r.reply_to,
    likesCount: r.likes,
    repostsCount: r.reposts,
    repliesCount: r.replies,
    quotesCount: r.quotes,
    bookmarksCount: r.bookmarks,
    isLiked: !!r.liked,
    isReposted: !!r.reposted,
    isBookmarked: !!r.bookmarked,
    reactions: deleted ? [] : reactions,
    quote,
    deleted,
  };
}

async function fetchRows(ids: number[], viewerId: number): Promise<PostRow[]> {
  if (ids.length === 0) return [];
  const params: Record<string, number> = { viewer: viewerId };
  const ph = ids.map((id, i) => {
    params[`i${i}`] = id;
    return `@i${i}`;
  });
  return db.all<PostRow>(`${POST_SELECT} WHERE p.id IN (${ph.join(',')})`, params);
}

/** 複数ポストのリアクションを 1 クエリでまとめて取得（絵文字ごとの件数と、閲覧者が付けたかどうか） */
async function fetchReactions(ids: number[], viewerId: number): Promise<Map<number, Reaction[]>> {
  const out = new Map<number, Reaction[]>();
  if (ids.length === 0) return out;
  const params: Record<string, number> = { viewer: viewerId };
  const ph = ids.map((id, i) => {
    params[`i${i}`] = id;
    return `@i${i}`;
  });
  const rows = await db.all<{ post_id: number; emoji_id: number; shortcode: string; image: string; cnt: number; mine: boolean }>(
    `SELECT r.post_id, e.id AS emoji_id, e.shortcode, e.image, COUNT(*) AS cnt, BOOL_OR(r.user_id = @viewer) AS mine
     FROM post_reactions r JOIN custom_emojis e ON e.id = r.emoji_id
     WHERE r.post_id IN (${ph.join(',')})
     GROUP BY r.post_id, e.id, e.shortcode, e.image
     ORDER BY MIN(r.id)`,
    params,
  );
  for (const r of rows) {
    const list = out.get(r.post_id) ?? [];
    list.push({ id: String(r.emoji_id), shortcode: r.shortcode, url: r.image, count: r.cnt, reacted: r.mine });
    out.set(r.post_id, list);
  }
  return out;
}

/** ID 群から Post をまとめて取得（引用元も含む） */
export async function getPosts(ids: number[], viewerId: number): Promise<Map<number, Post>> {
  const unique = [...new Set(ids)];
  const rows = await fetchRows(unique, viewerId);
  const quoteIds = rows.map((r) => r.quote_of).filter((x): x is number => !!x);
  const quoteRows = await fetchRows([...new Set(quoteIds)], viewerId);
  const reactions = await fetchReactions([...rows, ...quoteRows].map((r) => r.pid), viewerId);
  const quoteMap = new Map<number, Post>();
  for (const q of quoteRows) quoteMap.set(q.pid, toPost(q, null, reactions.get(q.pid) ?? []));
  const out = new Map<number, Post>();
  for (const r of rows) out.set(r.pid, toPost(r, r.quote_of ? (quoteMap.get(r.quote_of) ?? null) : null, reactions.get(r.pid) ?? []));
  return out;
}

export async function getPost(id: number, viewerId: number): Promise<Post | null> {
  return (await getPosts([id], viewerId)).get(id) ?? null;
}

export interface ItemRow {
  item_id: number;
  post_id: number;
  actor_id: number;
  cur: number;
}

export async function buildPage(rows: ItemRow[], limit: number, viewerId: number): Promise<Page<FeedItem>> {
  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit);
  const posts = await getPosts(slice.map((r) => r.post_id), viewerId);
  const actorIds = [...new Set(slice.filter((r) => r.item_id !== r.post_id).map((r) => r.actor_id))];
  const actors = new Map<number, ReturnType<typeof toUser>>();
  if (actorIds.length) {
    const ph = actorIds.map(() => '?').join(',');
    for (const u of await db.all<UserRow>(`SELECT ${USER_COLS} FROM users u WHERE u.id IN (${ph})`, actorIds)) {
      actors.set(u.id, toUser(u));
    }
  }
  const items: FeedItem[] = [];
  for (const r of slice) {
    const post = posts.get(r.post_id);
    if (!post || post.deleted) continue;
    items.push({
      id: String(r.item_id),
      post,
      repostedBy: r.item_id !== r.post_id ? (actors.get(r.actor_id) ?? null) : null,
    });
  }
  return { items, nextCursor: hasMore ? String(slice[slice.length - 1].cur) : null };
}

const FEED_BASE = `
  SELECT p.id AS item_id, COALESCE(p.repost_of, p.id) AS post_id, p.user_id AS actor_id, p.id AS cur
  FROM posts p LEFT JOIN posts o ON o.id = p.repost_of
  WHERE p.parent_id IS NULL AND p.deleted_at IS NULL AND (p.repost_of IS NULL OR o.deleted_at IS NULL)
    AND p.id < @cursor`;

export const PAGE_SIZE = 20;
export const MAX_CURSOR = Number.MAX_SAFE_INTEGER;

export async function feedPage(opts: { scope: 'for-you' | 'following'; viewerId: number; cursor: number }) {
  const extra =
    opts.scope === 'following'
      ? ' AND p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = @viewer UNION SELECT @viewer)'
      : '';
  const rows = await db.all<ItemRow>(`${FEED_BASE}${extra} ORDER BY p.id DESC LIMIT @lim`, {
    cursor: opts.cursor,
    viewer: opts.viewerId,
    lim: PAGE_SIZE + 1,
  });
  return buildPage(rows, PAGE_SIZE, opts.viewerId);
}

export async function userPostsPage(opts: {
  tab: 'posts' | 'replies' | 'media' | 'likes';
  userId: number;
  viewerId: number;
  cursor: number;
}) {
  const args = { cursor: opts.cursor, user: opts.userId, lim: PAGE_SIZE + 1 };
  let rows: ItemRow[];
  switch (opts.tab) {
    case 'posts':
      rows = await db.all<ItemRow>(`${FEED_BASE} AND p.user_id = @user ORDER BY p.id DESC LIMIT @lim`, args);
      break;
    case 'replies':
      rows = await db.all<ItemRow>(
        `SELECT p.id AS item_id, p.id AS post_id, p.user_id AS actor_id, p.id AS cur FROM posts p
         WHERE p.user_id = @user AND p.parent_id IS NOT NULL AND p.deleted_at IS NULL AND p.id < @cursor
         ORDER BY p.id DESC LIMIT @lim`,
        args,
      );
      break;
    case 'media':
      rows = await db.all<ItemRow>(
        `SELECT p.id AS item_id, p.id AS post_id, p.user_id AS actor_id, p.id AS cur FROM posts p
         WHERE p.user_id = @user AND p.repost_of IS NULL AND p.deleted_at IS NULL AND p.images <> '[]' AND p.id < @cursor
         ORDER BY p.id DESC LIMIT @lim`,
        args,
      );
      break;
    case 'likes':
      rows = await db.all<ItemRow>(
        `SELECT p.id AS item_id, p.id AS post_id, p.user_id AS actor_id, l.id AS cur
         FROM likes l JOIN posts p ON p.id = l.post_id
         WHERE l.user_id = @user AND p.deleted_at IS NULL AND l.id < @cursor
         ORDER BY l.id DESC LIMIT @lim`,
        args,
      );
      break;
  }
  return buildPage(rows, PAGE_SIZE, opts.viewerId);
}

export async function bookmarksPage(viewerId: number, cursor: number) {
  const rows = await db.all<ItemRow>(
    `SELECT p.id AS item_id, p.id AS post_id, p.user_id AS actor_id, b.id AS cur
     FROM bookmarks b JOIN posts p ON p.id = b.post_id
     WHERE b.user_id = @viewer AND p.deleted_at IS NULL AND b.id < @cursor
     ORDER BY b.id DESC LIMIT @lim`,
    { viewer: viewerId, cursor, lim: PAGE_SIZE + 1 },
  );
  return buildPage(rows, PAGE_SIZE, viewerId);
}

export async function repliesPage(postId: number, viewerId: number, cursor: number) {
  const rows = await db.all<ItemRow>(
    `SELECT p.id AS item_id, p.id AS post_id, p.user_id AS actor_id, p.id AS cur FROM posts p
     WHERE p.parent_id = @post AND p.deleted_at IS NULL AND p.id > @cursor ORDER BY p.id ASC LIMIT @lim`,
    { post: postId, cursor, lim: PAGE_SIZE + 1 },
  );
  return buildPage(rows, PAGE_SIZE, viewerId);
}

/** 返信元をたどって祖先ポストを古い順に返す */
export async function getAncestors(post: Post, viewerId: number): Promise<Post[]> {
  const chain: Post[] = [];
  let parentId = post.parentId ? Number(post.parentId) : null;
  while (parentId && chain.length < 20) {
    const p = await getPost(parentId, viewerId);
    if (!p) break;
    chain.unshift(p);
    parentId = p.parentId ? Number(p.parentId) : null;
  }
  return chain;
}

export async function searchPostsPage(opts: { q: string; viewerId: number; cursor: number }) {
  const args: Record<string, unknown> = { cursor: opts.cursor, lim: PAGE_SIZE + 1 };
  let rows: ItemRow[];
  const tagOnly = /^#([\p{L}\p{N}_]{1,50})$/u.exec(opts.q);
  if (tagOnly) {
    args.tag = tagOnly[1].normalize('NFKC').toLowerCase();
    rows = await db.all<ItemRow>(
      `SELECT p.id AS item_id, p.id AS post_id, p.user_id AS actor_id, p.id AS cur
       FROM post_tags t JOIN posts p ON p.id = t.post_id
       WHERE t.tag = @tag AND p.deleted_at IS NULL AND p.id < @cursor ORDER BY p.id DESC LIMIT @lim`,
      args as never,
    );
  } else {
    args.pat = `%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    rows = await db.all<ItemRow>(
      `SELECT p.id AS item_id, p.id AS post_id, p.user_id AS actor_id, p.id AS cur FROM posts p
       WHERE p.deleted_at IS NULL AND p.repost_of IS NULL AND p.content ILIKE @pat ESCAPE '\\' AND p.id < @cursor
       ORDER BY p.id DESC LIMIT @lim`,
      args as never,
    );
  }
  return buildPage(rows, PAGE_SIZE, opts.viewerId);
}

export async function createPost(input: {
  userId: number;
  content: string;
  images: string[];
  parentId: number | null;
  quoteOf: number | null;
}): Promise<number> {
  const alive = (id: number) =>
    db.get<{ id: number; user_id: number }>('SELECT id, user_id FROM posts WHERE id = ? AND deleted_at IS NULL AND repost_of IS NULL', [id]);
  const parent = input.parentId ? await alive(input.parentId) : undefined;
  if (input.parentId && !parent) throw new HttpError(404, '返信先のポストが見つかりません');
  const quoted = input.quoteOf ? await alive(input.quoteOf) : undefined;
  if (input.quoteOf && !quoted) throw new HttpError(404, '引用元のポストが見つかりません');

  return transaction(async (tx) => {
    const { lastId: id } = await tx.run(
      'INSERT INTO posts (user_id, content, images, parent_id, quote_of, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [input.userId, input.content, JSON.stringify(input.images), input.parentId, input.quoteOf, Date.now()],
    );
    for (const tag of extractTags(input.content)) {
      await tx.run('INSERT INTO post_tags (post_id, tag) VALUES (?, ?) ON CONFLICT DO NOTHING', [id, tag]);
    }

    const notified = new Set<number>([input.userId]);
    const once = async (uid: number, type: 'reply' | 'quote' | 'mention') => {
      if (notified.has(uid)) return;
      notified.add(uid);
      await notify(uid, input.userId, type, id, tx);
    };
    if (parent) await once(parent.user_id, 'reply');
    if (quoted) await once(quoted.user_id, 'quote');
    for (const name of extractMentions(input.content)) {
      const u = await tx.get<{ id: number }>('SELECT id FROM users WHERE lower(username) = lower(?)', [name]);
      if (u) await once(u.id, 'mention');
    }
    return id;
  });
}

/** ソフトデリート：返信スレッドを壊さないよう、本文だけを消す */
export async function deletePost(id: number, userId: number) {
  const row = await db.get<{ user_id: number }>('SELECT user_id FROM posts WHERE id = ? AND deleted_at IS NULL AND repost_of IS NULL', [id]);
  if (!row) throw new HttpError(404, 'ポストが見つかりません');
  if (row.user_id !== userId) throw new HttpError(403, '自分のポストのみ削除できます');
  await transaction(async (tx) => {
    await tx.run("UPDATE posts SET deleted_at = ?, content = '', images = '[]' WHERE id = ?", [Date.now(), id]);
    await tx.run('DELETE FROM post_tags WHERE post_id = ?', [id]);
    await tx.run('DELETE FROM posts WHERE repost_of = ?', [id]);
    await tx.run('DELETE FROM notifications WHERE post_id = ?', [id]);
    await tx.run('DELETE FROM bookmarks WHERE post_id = ?', [id]);
    await tx.run('DELETE FROM likes WHERE post_id = ?', [id]);
    await tx.run('DELETE FROM post_reactions WHERE post_id = ?', [id]);
  });
}

export async function trends(limit = 10) {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return db.all<{ tag: string; postsCount: number }>(
    `SELECT t.tag AS tag, COUNT(*) AS "postsCount" FROM post_tags t JOIN posts p ON p.id = t.post_id
     WHERE p.deleted_at IS NULL AND p.created_at > ? GROUP BY t.tag ORDER BY "postsCount" DESC, MAX(p.id) DESC LIMIT ?`,
    [since, limit],
  );
}
