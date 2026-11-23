import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { getPost } from './posts';

export interface PostMeta {
  /** 「○○さんのポスト」 */
  title: string;
  /** 「○○（@user）さんのポスト」 */
  ogTitle: string;
  description: string;
  /** ポストの 1 枚目の画像 → なければ投稿者のアイコン。どちらもなければ null（相対 URL のこともある） */
  image: string | null;
  /** image がポスト本文の画像か（true なら大きいカード、false ならアイコンなので小さいカード） */
  imageIsPost: boolean;
  createdAt: string;
}

/**
 * 外部共有（X・Discord・LINE・Slack などの OGP カード）用のポスト情報。ログイン状態に関係なく同じ内容を返す。
 * 削除済みのポストは null。同じポストが何度もクロールされるので短時間キャッシュする。
 */
export async function getPostMeta(id: number): Promise<PostMeta | null> {
  'use cache';
  cacheLife({ stale: 60, revalidate: 60, expire: 60 * 60 });
  cacheTag(`post-meta-${id}`);

  const post = await getPost(id, 0);
  if (!post || post.deleted) return null;

  const text = post.content.replace(/\s+/g, ' ').trim();
  const chars = Array.from(text);
  const description = chars.length > 200 ? chars.slice(0, 199).join('') + '…' : text || (post.images.length ? '画像付きのポスト' : '');
  const name = post.author.name;
  return {
    title: `${name}さんのポスト`,
    ogTitle: `${name}（@${post.author.username}）さんのポスト`,
    description,
    image: post.images[0] ?? post.author.avatarUrl ?? null,
    imageIsPost: post.images.length > 0,
    createdAt: post.createdAt,
  };
}
