'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { CreatePostForm } from '@/components/CreatePostForm';
import { InfiniteList } from '@/components/InfiniteList';
import { EmptyState, PageHeader, Tabs } from '@/components/PageHeader';
import { PostCard } from '@/components/PostCard';
import { useInfiniteList } from '@/hooks/use-queries';
import type { FeedItem } from '@/types/post';

const TABS = [
  { id: 'for-you', label: 'おすすめ' },
  { id: 'following', label: 'フォロー中' },
] as const;

export default function TimelinePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('for-you');
  const feed = useInfiniteList<FeedItem>(['feed', tab], `/api/posts?feed=${tab}`, { refetchInterval: 60_000 });

  return (
    <div className="min-h-screen">
      <PageHeader title="タイムライン" back="/">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </PageHeader>

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
        <p className="text-center text-xs text-muted-foreground p-4">
          <Link href="/explore" className="text-primary hover:underline">おすすめユーザーを探す</Link>
        </p>
      )}
    </div>
  );
}
