'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Hash, Radio, Repeat2 } from 'lucide-react';
import { RichText } from '@/components/RichText';
import { Spinner } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/time';
import type { FeedItem, Page } from '@/types/post';

/** ホームに出す「いま流れているポスト」。5 秒ごとに更新し、新着は上から差し込まれる */
export function LiveFeed() {
  const q = useQuery({
    queryKey: ['live-feed'],
    queryFn: () => api<Page<FeedItem>>('/api/posts/live'),
    refetchInterval: 5_000,
    staleTime: 2_000,
  });
  const items = q.data?.items ?? [];

  return (
    <section aria-labelledby="live-title" className="border-b border-border/60">
      <h2 id="live-title" className="font-bold text-lg p-4 pb-2 flex items-center gap-2">
        <span className="relative flex size-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-60 animate-ping" />
          <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
        </span>
        リアルタイム
        <Radio className="w-4 h-4 text-muted-foreground" aria-hidden />
      </h2>

      {q.isPending ? (
        <Spinner className="py-6" />
      ) : q.isError && items.length === 0 ? (
        <p className="px-4 pb-6 text-sm text-muted-foreground">読み込めませんでした。時間をおいてお試しください。</p>
      ) : items.length === 0 ? (
        <p className="px-4 pb-6 text-sm text-muted-foreground">まだポストがありません。</p>
      ) : (
        <ul aria-live="polite" className="pb-2">
          {items.map((item) => {
            const p = item.post;
            return (
              // key がポスト単位なので、新着だけがアニメーションして挿入される
              <li key={item.id} className="animate-in fade-in slide-in-from-top-2 duration-500">
                <Link href={`/posts/${p.id}`} className="flex gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors">
                  <UserAvatar user={p.author} className="size-9 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm min-w-0">
                      <span className="font-bold truncate">{p.author.name}</span>
                      <span className="text-muted-foreground truncate">@{p.author.username}</span>
                      <span className="text-muted-foreground text-xs shrink-0">· {formatRelative(p.createdAt)}</span>
                    </span>
                    {(item.repostedBy || p.channel) && (
                      <span className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {item.repostedBy && (
                          <span className="inline-flex items-center gap-0.5">
                            <Repeat2 className="w-3 h-3" />
                            {item.repostedBy.name}
                          </span>
                        )}
                        {p.channel && (
                          <span className="inline-flex items-center gap-0.5 text-primary">
                            <Hash className="w-3 h-3" />
                            {p.channel.name}
                          </span>
                        )}
                      </span>
                    )}
                    {p.content ? (
                      <RichText text={p.content} plain className="text-sm line-clamp-2 text-foreground/90" />
                    ) : (
                      <span className="text-sm text-muted-foreground">{p.images.length > 0 ? '画像のポスト' : ''}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
