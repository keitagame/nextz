'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Hash } from 'lucide-react';
import { ImageGrid } from '@/components/ImageGrid';
import { LinkPreview } from '@/components/LinkPreview';
import { EmptyState, PageHeader, Spinner } from '@/components/PageHeader';
import { PostActions } from '@/components/PostActions';
import { PostMenu, QuotedPost } from '@/components/PostCard';
import { RichText } from '@/components/RichText';
import { UserAvatar } from '@/components/UserAvatar';
import { ReactionBar } from '@/components/ReactionBar';
import { UserBadges } from '@/components/UserBadges';
import { api } from '@/lib/api';
import { useImpression } from '@/lib/impressions';
import { formatFull } from '@/lib/time';
import type { Post } from '@/types/post';

export function PostDetailView() {
  const { id } = useParams<{ id: string }>();
  const detail = useQuery({ queryKey: ['post', id], queryFn: () => api<{ post: Post }>(`/api/posts/${id}`) });

  return (
    <div className="min-h-screen pb-16">
      <PageHeader title="ポスト" back />
      {detail.isPending ? (
        <Spinner />
      ) : detail.isError ? (
        <EmptyState title="このポストは存在しません" description="削除されたか、URLが間違っている可能性があります。" />
      ) : (
        <Detail key={detail.data.post.id} post={detail.data.post} />
      )}
    </div>
  );
}

function Detail({ post }: { post: Post }) {
  const router = useRouter();
  const [prev, setPrev] = useState(post);
  const [p, setP] = useState(post);
  if (post !== prev) {
    setPrev(post);
    setP(post);
  }
  const impressionRef = useImpression(post.id);

  return (
    <>
      <article ref={impressionRef} className="px-4 pt-4 border-b border-border/60 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/${p.author.username}`} className="flex items-center gap-3 min-w-0">
            <UserAvatar user={p.author} className="size-11" />
            <div className="min-w-0">
              <p className="font-bold leading-tight flex items-center gap-1 hover:underline">
                <span className="truncate">{p.author.name}</span>
                <UserBadges user={p.author} className="size-5" />
              </p>
              <p className="text-sm text-muted-foreground truncate">@{p.author.username}</p>
            </div>
          </Link>
          <PostMenu post={p} onDeleted={() => router.push(p.channel ? `/channels/${p.channel.id}` : '/')} />
        </div>

        {p.channel && (
          <p className="text-sm text-muted-foreground">
            <Link href={`/channels/${p.channel.id}`} className="inline-flex items-center gap-0.5 text-primary hover:underline">
              <Hash className="w-3.5 h-3.5" />
              {p.channel.name}
            </Link>
          </p>
        )}
        {p.content && <RichText text={p.content} className="text-lg sm:text-xl leading-relaxed" />}
        <ImageGrid images={p.images} className="mt-0" />
        {p.quote && <QuotedPost post={p.quote} />}
        {p.content && p.images.length === 0 && !p.quote && <LinkPreview text={p.content} />}
        <ReactionBar post={p} setPost={setP} />

        <div className="text-sm text-muted-foreground border-b border-border/40 pb-3">{formatFull(p.createdAt)}</div>

        {(p.impressionsCount > 0 || p.repostsCount > 0 || p.quotesCount > 0 || p.likesCount > 0 || p.bookmarksCount > 0) && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm border-b border-border/40 pb-3">
            {p.impressionsCount > 0 && <Stat n={p.impressionsCount} label="インプレッション" />}
            {p.repostsCount > 0 && <Stat n={p.repostsCount} label="リポスト" />}
            {p.quotesCount > 0 && <Stat n={p.quotesCount} label="引用" />}
            {p.likesCount > 0 && <Stat n={p.likesCount} label="いいね" />}
            {p.bookmarksCount > 0 && <Stat n={p.bookmarksCount} label="ブックマーク" />}
          </div>
        )}

        <div className="pb-1">
          <PostActions post={p} setPost={setP} variant="detail" />
        </div>
      </article>
    </>
  );
}

const Stat = ({ n, label }: { n: number; label: string }) => (
  <span>
    <strong className="text-foreground">{n.toLocaleString('ja-JP')}</strong> <span className="text-muted-foreground">{label}</span>
  </span>
);
