'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp } from 'lucide-react';
import { InfiniteList } from '@/components/InfiniteList';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader, Spinner, Tabs } from '@/components/PageHeader';
import { PostCard } from '@/components/PostCard';
import { UserListItem } from '@/components/UserListItem';
import { useInfiniteList } from '@/hooks/use-queries';
import { api } from '@/lib/api';
import { formatCount } from '@/lib/time';
import type { FeedItem, Trend, UserSummary } from '@/types/post';

const TABS = [
  { id: 'posts', label: 'ポスト' },
  { id: 'users', label: 'ユーザー' },
] as const;

export function ExploreView() {
  const q = useSearchParams().get('q')?.trim() ?? '';
  return <ExploreContent key={q} q={q} />;
}

function ExploreContent({ q }: { q: string }) {
  const router = useRouter();
  const [input, setInput] = useState(q);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('posts');

  return (
    <div className="min-h-screen">
      <PageHeader
        title={
          <form
            role="search"
            className="relative w-full"
            onSubmit={(e) => {
              e.preventDefault();
              const v = input.trim();
              router.push(v ? `/explore?q=${encodeURIComponent(v)}` : '/explore');
            }}
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="キーワード・#ハッシュタグ・@ユーザーを検索"
              aria-label="検索"
              className="pl-10 h-10 rounded-full bg-accent/50 border-none font-normal"
            />
          </form>
        }
      >
        {q && <Tabs tabs={TABS} value={tab} onChange={setTab} />}
      </PageHeader>

      {q ? <Results q={q} tab={tab} /> : <Discover />}
    </div>
  );
}

function Results({ q, tab }: { q: string; tab: 'posts' | 'users' }) {
  const enc = encodeURIComponent(q);
  const posts = useInfiniteList<FeedItem>(['search', 'posts', q], `/api/search?type=posts&q=${enc}`, { enabled: tab === 'posts' });
  const users = useInfiniteList<UserSummary>(['search', 'users', q], `/api/search?type=users&q=${enc}`, { enabled: tab === 'users' });

  return tab === 'posts' ? (
    <InfiniteList
      query={posts}
      render={(i) => <PostCard post={i.post} />}
      empty={<EmptyState icon={<Search className="w-6 h-6" />} title={`「${q}」に一致するポストはありません`} description="別のキーワードでお試しください。" />}
    />
  ) : (
    <InfiniteList
      query={users}
      render={(u) => <UserListItem user={u} />}
      empty={<EmptyState icon={<Search className="w-6 h-6" />} title={`「${q}」に一致するユーザーはいません`} />}
    />
  );
}

function Discover() {
  const trends = useQuery({ queryKey: ['trends'], queryFn: () => api<{ items: Trend[] }>('/api/trends'), staleTime: 60_000 });
  const suggestions = useQuery({ queryKey: ['suggestions', 10], queryFn: () => api<{ items: UserSummary[] }>('/api/suggestions?limit=10'), staleTime: 60_000 });

  return (
    <>
      <div className="p-4 font-bold text-lg flex items-center gap-2 border-b border-border/60">
        <TrendingUp className="w-5 h-5 text-primary" />
        <span>いま話題のトレンド</span>
      </div>
      {trends.isPending ? (
        <Spinner />
      ) : trends.data?.items.length ? (
        <div className="divide-y divide-border/60">
          {trends.data.items.map((t, i) => (
            <Link key={t.tag} href={`/explore?q=${encodeURIComponent(`#${t.tag}`)}`} className="block p-4 hover:bg-accent/30 transition-colors">
              <p className="text-xs text-muted-foreground">{i + 1} · 過去7日間のトレンド</p>
              <p className="font-bold text-base">#{t.tag}</p>
              <p className="text-xs text-muted-foreground">{formatCount(t.postsCount)} 件のポスト</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">トレンドはまだありません。ポストに #ハッシュタグ を付けると、ここに表示されます。</p>
      )}

      {suggestions.data && suggestions.data.items.length > 0 && (
        <>
          <div className="p-4 font-bold text-lg border-y border-border/60 bg-muted/30">おすすめユーザー</div>
          <div className="divide-y divide-border/40">
            {suggestions.data.items.map((u) => (
              <UserListItem key={u.id} user={u} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
