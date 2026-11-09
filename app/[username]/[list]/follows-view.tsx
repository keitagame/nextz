'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { InfiniteList } from '@/components/InfiniteList';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { UserListItem } from '@/components/UserListItem';
import { useInfiniteList } from '@/hooks/use-queries';
import { cn } from '@/lib/utils';
import type { UserSummary } from '@/types/post';

export function FollowsView() {
  const { username, list } = useParams<{ username: string; list: string }>();
  const valid = list === 'followers' || list === 'following';
  const query = useInfiniteList<UserSummary>(['follows', username, list], `/api/users/${username}/follows?type=${list}`, { enabled: valid });

  if (!valid) return <EmptyState title="ページが見つかりません" />;

  const tab = (id: string, label: string) => (
    <Link
      href={`/${username}/${id}`}
      replace
      className={cn('flex-1 py-3 text-sm font-semibold text-center relative hover:bg-accent/40', list === id ? 'font-bold' : 'text-muted-foreground')}
    >
      {label}
      {list === id && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-full" />}
    </Link>
  );

  return (
    <div className="min-h-screen">
      <PageHeader title={`@${username}`} back={`/${username}`}>
        <div className="flex border-t border-border/40">
          {tab('followers', 'フォロワー')}
          {tab('following', 'フォロー中')}
        </div>
      </PageHeader>
      <InfiniteList
        query={query}
        className="divide-y divide-border/40"
        render={(u) => <UserListItem user={u} />}
        empty={<EmptyState title={list === 'followers' ? 'フォロワーはまだいません' : 'フォローしているアカウントはありません'} />}
      />
    </div>
  );
}
