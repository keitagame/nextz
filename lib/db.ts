import 'server-only';
import path from 'node:path';
import { Pool, types, type PoolClient } from 'pg';
import { attachDatabasePool } from '@vercel/functions';

/**
 * DB は Postgres（Neon）。環境変数:
 *   DATABASE_URL  Neon の接続文字列（Vercel の Neon 連携が自動で設定します。POSTGRES_URL でも可）
 *                 Vercel / サーバーレスでは「Pooled connection」（ホスト名に -pooler が付く方）を使ってください。
 *
 * アップロード画像のローカル保存先（BLOB_READ_WRITE_TOKEN 未設定の開発時のみ使用）は DATA_DIR（既定 ./data/uploads）。
 */
export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

// BIGINT (int8) / COUNT(*) は pg だと文字列で返るため数値に変換する（ID・時刻(ms)は 2^53 未満）
types.setTypeParser(20, (v) => Number(v));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  avatar TEXT,
  banner TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username ON users (lower(username));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',
  parent_id BIGINT REFERENCES posts(id),
  repost_of BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  quote_of BIGINT REFERENCES posts(id),
  deleted_at BIGINT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, id);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id, id);
CREATE INDEX IF NOT EXISTS idx_posts_repost ON posts(repost_of);
CREATE INDEX IF NOT EXISTS idx_posts_quote ON posts(quote_of);
CREATE UNIQUE INDEX IF NOT EXISTS ux_posts_repost ON posts(user_id, repost_of) WHERE repost_of IS NOT NULL;

CREATE TABLE IF NOT EXISTS post_tags (
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON post_tags(tag, post_id);

CREATE TABLE IF NOT EXISTS likes (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id, id);

CREATE TABLE IF NOT EXISTS bookmarks (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_post ON bookmarks(post_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id, id);

CREATE TABLE IF NOT EXISTS follows (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  follower_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id, id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id, id);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  read INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_notif_once
  ON notifications(user_id, actor_id, type, (COALESCE(post_id, 0)))
  WHERE type IN ('like', 'repost', 'follow');

CREATE TABLE IF NOT EXISTS dm_threads (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_a BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at BIGINT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dm_thread ON dm_messages(thread_id, id);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  hit_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits ON rate_limits(bucket, hit_at);
`;

/**
 * カスタム絵文字まわりのスキーマ。既存の DB にも適用できるよう、すべて冪等（IF NOT EXISTS）にしてある。
 * 基本スキーマ（SCHEMA）の作成後に、まだ適用されていなければ実行する。
 */
const EMOJI_SCHEMA = `
CREATE TABLE IF NOT EXISTS custom_emojis (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shortcode TEXT NOT NULL,
  image TEXT NOT NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_emoji_shortcode ON custom_emojis (lower(shortcode));

ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_emoji_id BIGINT REFERENCES custom_emojis(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emoji_id BIGINT REFERENCES custom_emojis(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS ux_notif_reaction
  ON notifications(user_id, actor_id, post_id, emoji_id)
  WHERE type = 'reaction';

CREATE TABLE IF NOT EXISTS post_reactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  emoji_id BIGINT NOT NULL REFERENCES custom_emojis(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, post_id, emoji_id)
);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON post_reactions(post_id, id);
CREATE INDEX IF NOT EXISTS idx_reactions_emoji ON post_reactions(emoji_id);
`;

/**
 * チャンネル（コミュニティ）まわりのスキーマ。既存の DB にも適用できるよう、すべて冪等にしてある。
 *   channels          チャンネル本体（owner_id = 作成者 = 管理者）
 *   channel_members   参加メンバー（作成者も含む）
 *   channel_bans      キックされたユーザー（再参加できない。管理者が解除できる）
 *   channel_posts     チャンネル内の独自タイムライン
 * users.last_seen_at はホームの「アクティブユーザー」表示に使う。
 */
const CHANNEL_SCHEMA = `
CREATE TABLE IF NOT EXISTS channels (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_channels_name ON channels (lower(name));
CREATE INDEX IF NOT EXISTS idx_channels_owner ON channels(owner_id);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at BIGINT NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);

CREATE TABLE IF NOT EXISTS channel_bans (
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_at BIGINT NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS channel_posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channel_posts ON channel_posts(channel_id, id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at BIGINT;
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at);
`;

/**
 * ボット（開発者向け API）まわりのスキーマ。既存の DB にも適用できるよう、すべて冪等にしてある。
 *   bots  ボット = 専用のユーザーアカウント（users 行）+ 所有者 + API トークン（SHA-256 ハッシュのみ保存）
 */
const BOT_SCHEMA = `
CREATE TABLE IF NOT EXISTS bots (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  last_used_at BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_bots_token ON bots(token_hash);
CREATE INDEX IF NOT EXISTS idx_bots_owner ON bots(owner_id);
`;

/**
 * チャンネル内の投稿を、グローバルと同じ posts テーブルに統合するためのスキーマ。既存の DB にも適用できるよう冪等にしてある。
 *   posts.channel_id  NULL = グローバルのポスト / 値あり = そのチャンネル内のポスト（返信・リポスト・引用も同じチャンネルに属する）
 * 旧 channel_posts の行は posts に移してから空にする（移行は 1 回だけ。channel_posts テーブル自体は互換のため残す）。
 * これにより、いいね・リポスト・引用・返信・リアクション・ブックマーク・通知がチャンネルでもそのまま使える。
 */
const CHANNEL_POST_SCHEMA = `
ALTER TABLE posts ADD COLUMN IF NOT EXISTS channel_id BIGINT REFERENCES channels(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_posts_channel ON posts(channel_id, id) WHERE channel_id IS NOT NULL;

INSERT INTO posts (user_id, content, images, channel_id, created_at)
  SELECT user_id, content, images, channel_id, created_at FROM channel_posts ORDER BY id;
DELETE FROM channel_posts;
`;

export type Args = unknown[] | Record<string, unknown>;

/**
 * SQL 内の `?`（位置引数）/ `@name`（名前付き引数）を Postgres の `$1, $2...` に変換する。
 * 文字列リテラル('...')の中は触らない。同じ @name は同じ $n を再利用する。
 */
function toPg(sql: string, args: Args = []): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const named = new Map<string, number>();
  let text = '';
  let inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      inStr = !inStr;
      text += ch;
    } else if (!inStr && ch === '?') {
      if (!Array.isArray(args)) throw new Error('positional ? used with named args');
      values.push(args[values.length]);
      text += `$${values.length}`;
    } else if (!inStr && ch === '@' && /[A-Za-z_]/.test(sql[i + 1] ?? '')) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i + 1))![0];
      if (Array.isArray(args)) throw new Error('named @arg used with positional args');
      if (!(m in args)) throw new Error(`missing SQL argument: ${m}`);
      let n = named.get(m);
      if (!n) {
        values.push(args[m]);
        n = values.length;
        named.set(m, n);
      }
      text += `$${n}`;
      i += m.length;
    } else {
      text += ch;
    }
  }
  return { text, values };
}

/** get / all / run を持つ共通インターフェース（通常実行とトランザクション内で共用） */
export interface Executor {
  all<T = Record<string, unknown>>(sql: string, args?: Args): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, args?: Args): Promise<T | undefined>;
  /** INSERT ... RETURNING id を使った場合、lastId にその id が入る */
  run(sql: string, args?: Args): Promise<{ lastId: number; changes: number }>;
}

type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> };

function executor(getQ: () => Promise<Queryable>): Executor {
  const exec = async (sql: string, args?: Args) => {
    const { text, values } = toPg(sql, args);
    return (await getQ()).query(text, values);
  };
  return {
    async all<T>(sql: string, args?: Args) {
      return (await exec(sql, args)).rows as unknown as T[];
    },
    async get<T>(sql: string, args?: Args) {
      return (await exec(sql, args)).rows[0] as unknown as T | undefined;
    },
    async run(sql: string, args?: Args) {
      const r = await exec(sql, args);
      return { lastId: Number(r.rows[0]?.id ?? 0), changes: r.rowCount ?? 0 };
    },
  };
}

const g = globalThis as unknown as { __nextzPool?: Pool; __nextzReady?: Promise<Pool> };

async function init(): Promise<Pool> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error('DATABASE_URL が設定されていません（Neon の接続文字列を設定してください。.env.example を参照）');
  }
  const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
  pool.on('error', (e) => console.error('[pg pool error]', e));
  // Vercel (Fluid compute) で、関数停止前にアイドル接続を閉じられるようにする
  try {
    attachDatabasePool(pool);
  } catch {
    /* Vercel 外では何もしない */
  }

  // スキーマ作成は初回のみ。複数インスタンスが同時に起動しても競合しないよう advisory lock をかける。
  // 基本スキーマ（rate_limits を目印）・カスタム絵文字（post_reactions を目印）・チャンネル（channel_posts を目印）・ボット（bots を目印）・チャンネル投稿の統合（posts.channel_id を目印）を別々に判定する。
  // こうすると、すでに運用中の DB にも絵文字用のテーブル・列が自動で追加される。
  const { rows } = await pool.query(
    "SELECT to_regclass('public.rate_limits') IS NOT NULL AS base, to_regclass('public.post_reactions') IS NOT NULL AS emoji, to_regclass('public.channel_posts') IS NOT NULL AS channel, to_regclass('public.bots') IS NOT NULL AS bot, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'channel_id') AS chpost",
  );
  if (!rows[0].base || !rows[0].emoji || !rows[0].channel || !rows[0].bot || !rows[0].chpost) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock(727274)');
      if (!rows[0].base) await c.query(SCHEMA);
      await c.query(EMOJI_SCHEMA);
      await c.query(CHANNEL_SCHEMA);
      await c.query(BOT_SCHEMA);
      await c.query(CHANNEL_POST_SCHEMA);
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }
  g.__nextzPool = pool;
  return pool;
}

function pool(): Promise<Pool> {
  if (g.__nextzPool) return Promise.resolve(g.__nextzPool);
  g.__nextzReady ??= init().catch((e) => {
    g.__nextzReady = undefined;
    throw e;
  });
  return g.__nextzReady;
}

export const db: Executor = executor(pool);

/** トランザクション。fn が例外を投げたらロールバックする。 */
export async function transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
  const client: PoolClient = await (await pool()).connect();
  try {
    await client.query('BEGIN');
    const result = await fn(executor(async () => client));
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
