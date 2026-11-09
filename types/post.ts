/** API とクライアントで共有する型定義 */

/** カスタム絵文字の参照（バッジ・リアクション・通知で使う最小限の情報） */
export interface EmojiRef {
  id: string;
  /** `:shortcode:` の shortcode 部分（小文字） */
  shortcode: string;
  url: string;
}

/** 絵文字一覧用 */
export interface CustomEmoji extends EmojiRef {
  /** 自分が登録した絵文字か（削除できるのは登録者のみ） */
  mine: boolean;
}

export interface Reaction extends EmojiRef {
  count: number;
  /** 自分がこの絵文字でリアクション済みか */
  reacted: boolean;
}

export interface User {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  isVerified?: boolean;
  /** ボットアカウントか */
  isBot?: boolean;
  /** プロフィール名の横に表示するカスタム絵文字バッジ */
  badge?: EmojiRef | null;
}

/** 一覧表示用（フォロー候補・検索結果・フォロー一覧など） */
export interface UserSummary extends User {
  bio: string;
  isFollowing: boolean;
  followsYou: boolean;
}

export interface Profile extends UserSummary {
  bannerUrl: string | null;
  location: string;
  website: string;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isMe: boolean;
}

export interface Post {
  id: string;
  author: User;
  content: string;
  images: string[];
  createdAt: string;
  parentId: string | null;
  replyToUsername: string | null;
  likesCount: number;
  repostsCount: number;
  repliesCount: number;
  quotesCount: number;
  bookmarksCount: number;
  isLiked: boolean;
  isReposted: boolean;
  isBookmarked: boolean;
  /** カスタム絵文字リアクション（最初に付けられた順） */
  reactions: Reaction[];
  quote: Post | null;
  deleted: boolean;
}

export interface FeedItem {
  /** ページネーション用のアイテムID（リポストの場合はリポスト行のID） */
  id: string;
  post: Post;
  repostedBy: User | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type NotificationType = 'like' | 'repost' | 'quote' | 'reply' | 'follow' | 'mention' | 'reaction';

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: User;
  read: boolean;
  createdAt: string;
  post: { id: string; content: string } | null;
  /** type が reaction のときの絵文字 */
  emoji: EmojiRef | null;
}

export interface DmMessage {
  id: string;
  mine: boolean;
  body: string;
  createdAt: string;
}

export interface DmThread {
  id: string;
  other: User;
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface Trend {
  tag: string;
  postsCount: number;
}

export interface Counters {
  notifications: number;
  messages: number;
}

/** チャンネル（コミュニティ） */
export interface Channel {
  id: string;
  name: string;
  description: string;
  /** 絵文字 1 文字（未設定なら空文字） */
  icon: string;
  /** 作成者 = 管理者 */
  owner: User;
  membersCount: number;
  postsCount: number;
  createdAt: string;
  lastPostAt: string | null;
  isMember: boolean;
  /** 自分が管理者（作成者）か */
  isOwner: boolean;
  /** 管理者にキックされていて参加できないか */
  isBanned: boolean;
}

export interface ChannelPost {
  id: string;
  author: User;
  content: string;
  images: string[];
  createdAt: string;
  /** 投稿者本人、またはチャンネル管理者なら削除できる */
  canDelete: boolean;
  /** 投稿者がチャンネル管理者か */
  byOwner: boolean;
}

export interface ChannelMember {
  user: User;
  isOwner: boolean;
  joinedAt: string;
}

/** ホームの「アクティブユーザー」 */
export interface ActiveUser extends User {
  lastSeenAt: string;
}

/** 開発者設定：自分が作成したボット */
export interface Bot {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  /** トークンの先頭数文字（識別用。全文は作成・再発行時の一度しか表示されない） */
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}
