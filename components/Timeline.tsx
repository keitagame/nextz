'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Users } from 'lucide-react';
import { CreatePostForm } from '@/components/CreatePostForm';
import { InfiniteList } from '@/components/InfiniteList';
import { MenuButton, EmptyState, Tabs } from '@/components/PageHeader';
import { PostCard } from '@/components/PostCard';
import { useInfiniteList, useMe } from '@/hooks/use-queries';
import { api } from '@/lib/api';
import type { FeedItem, Page } from '@/types/post';

const TABS = [
  { id: 'for-you', label: 'おすすめ' },
  { id: 'following', label: 'フォロー中' },
] as const;

/** ホーム = タイムライン。X と同じく、上部のタブ（おすすめ / フォロー中）→ 投稿フォーム → ポストの流れ */
export function Timeline() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('for-you');
  const url = `/api/posts?feed=${tab}`;
  // 読んでいる最中にリストが動かないよう自動更新はせず、新着は「N 件のポストを表示」で知らせる
  const feed = useInfiniteList<FeedItem>(['feed', tab], url);
  const head = useQuery({
    queryKey: ['feed-head', tab],
    queryFn: () => api<Page<FeedItem>>(url),
    refetchInterval: 15_000,
    enabled: feed.isSuccess,
  });

  const topId = feed.data?.pages[0]?.items[0]?.id;
  const headItems = head.data?.items ?? [];
  const idx = topId ? headItems.findIndex((i) => i.id === topId) : -1;
  const newCount = !topId || feed.isFetching ? 0 : idx === -1 ? headItems.length : idx;

  function showNew() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    qc.invalidateQueries({ queryKey: ['feed', tab] });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        {/* スマホ：アバター（全機能のドロワー）とロゴ */}
        <div className="sm:hidden relative flex items-center justify-between px-4 h-[53px]">
          <MenuButton />
          <Link href="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-black leading-none" aria-label="Z ホーム">
            ℤ
          </Link>
          {!me && (
            <Link href="/login" className="ml-auto rounded-full bg-primary text-primary-foreground text-sm font-bold px-4 h-8 inline-flex items-center">
              ログイン
            </Link>
          )}
        </div>
        {/* 「フォロー中」はログインしていないと意味がないので、ゲストには出さない */}
        <Tabs tabs={me ? TABS : TABS.filter((t) => t.id === 'for-you')} value={tab} onChange={setTab} />
        {newCount > 0 && (
          <div className="absolute left-0 right-0 top-full flex justify-center pt-3 pointer-events-none">
            <button
              onClick={showNew}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-[15px] font-bold px-4 h-9 shadow-lg hover:bg-primary/90 active:scale-95 transition-all animate-in fade-in slide-in-from-top-2"
            >
              <ArrowUp className="w-4 h-4" />
              {newCount} 件のポストを表示
            </button>
          </div>
        )}
      </header>

      <CreatePostForm />

      <InfiniteList
        query={feed}
        render={(item) => <PostCard post={item.post} repostedBy={item.repostedBy} />}
        empty={
          tab === 'following' ? (
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title="フォロー中のポストがありません"
              description="気になるアカウントをフォローすると、ここにポストが表示されます。"
            />
          ) : (
            <EmptyState title="最初のポストをしてみましょう" description="上のフォームからポストできます。" />
          )
        }
      />
      {tab === 'following' && (
        <p className="text-center text-sm p-4">
          <Link href="/explore" className="text-primary hover:underline">おすすめユーザーを探す</Link>
        </p>
      )}
    </div>
  );
}
