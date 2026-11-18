'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { UserBadges } from '@/components/UserBadges';
import { UserListItem } from '@/components/UserListItem';
import { buttonVariants } from '@/components/ui/button';
import { useMe } from '@/hooks/use-queries';
import { api } from '@/lib/api';
import { formatCount, formatRelative } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { ActiveUser, Trend, UserSummary } from '@/types/post';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-muted overflow-hidden">
      <h2 className="text-xl font-extrabold px-4 py-3">{title}</h2>
      {children}
    </section>
  );
}

/** X 風の右カラム：検索 / アクティブなユーザー / いまどうなってる？ / おすすめユーザー */
export function RightSidebar() {
  const router = useRouter();
  const { data: me } = useMe();
  const [q, setQ] = useState('');
  const trends = useQuery({ queryKey: ['trends'], queryFn: () => api<{ items: Trend[] }>('/api/trends'), staleTime: 60_000 });
  const suggestions = useQuery({ queryKey: ['suggestions', 3], queryFn: () => api<{ items: UserSummary[] }>('/api/suggestions?limit=3'), staleTime: 60_000 });
  const active = useQuery({
    queryKey: ['active-users'],
    queryFn: () => api<{ items: ActiveUser[] }>('/api/users/active'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  return (
    <aside className="hidden md:block w-[280px] lg:w-[350px] pl-4 lg:pl-6 pr-2 space-y-4 sticky top-0 h-screen overflow-y-auto shrink-0 pb-6">
      <form
        role="search"
        className="sticky-bg sticky top-0 z-10 bg-background py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/explore?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <label className="group flex items-center gap-3 h-11 px-4 rounded-full bg-muted border border-transparent focus-within:border-primary focus-within:bg-background transition-colors">
          <Search className="w-[18px] h-[18px] text-muted-foreground group-focus-within:text-primary shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            // 日本語入力の変換確定の Enter では検索しない
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault();
            }}
            placeholder="検索"
            aria-label="キーワード検索"
            enterKeyHint="search"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground"
          />
        </label>
      </form>

      {!me && (
        <section className="rounded-2xl border border-border p-4 space-y-2">
          <h2 className="text-xl font-extrabold">Zに参加しよう</h2>
          <p className="text-sm text-muted-foreground">ログインすると、ポスト・いいね・フォローが使えます。</p>
          <Link href="/login" className={cn(buttonVariants(), 'w-full rounded-full h-10 font-bold text-[15px]')}>
            ログイン / 新規登録
          </Link>
        </section>
      )}

      <Panel title="アクティブなユーザー">
        {active.isPending ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">読み込み中…</p>
        ) : active.data?.items.length ? (
          <ul>
            {active.data.items.slice(0, 5).map((u) => (
              <li key={u.id}>
                <Link href={`/${u.username}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/60 transition-colors">
                  <span className="relative shrink-0">
                    <UserAvatar user={u} className="size-10" />
                    <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-muted" aria-hidden />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-bold text-[15px] flex items-center gap-1">
                      <span className="truncate">{u.name}</span>
                      <UserBadges user={u} />
                    </span>
                    <span className="block text-[13px] text-muted-foreground truncate">@{u.username}</span>
                  </span>
                  <span className="text-xs shrink-0 text-emerald-500">{formatRelative(u.lastSeenAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-4 text-sm text-muted-foreground">いまアクティブなユーザーはいません。</p>
        )}
      </Panel>

      <Panel title="いまどうなってる？">
        {trends.data?.items.length === 0 && <p className="px-4 pb-4 text-sm text-muted-foreground">トレンドはまだありません。#ハッシュタグ付きでポストしてみましょう。</p>}
        {trends.data?.items.slice(0, 5).map((t) => (
          <Link key={t.tag} href={`/explore?q=${encodeURIComponent(`#${t.tag}`)}`} className="block px-4 py-3 hover:bg-accent/60 transition-colors">
            <p className="text-[13px] text-muted-foreground">トレンド</p>
            <p className="font-bold text-[15px]">#{t.tag}</p>
            <p className="text-[13px] text-muted-foreground">{formatCount(t.postsCount)} 件のポスト</p>
          </Link>
        ))}
        <Link href="/explore" className="block px-4 py-3 text-[15px] text-primary hover:bg-accent/60 transition-colors">
          さらに表示
        </Link>
      </Panel>

      {suggestions.data && suggestions.data.items.length > 0 && (
        <Panel title="おすすめユーザー">
          {suggestions.data.items.map((u) => (
            <UserListItem key={u.id} user={u} compact />
          ))}
          <Link href="/explore" className="block px-4 py-3 text-[15px] text-primary hover:bg-accent/60 transition-colors">
            さらに表示
          </Link>
        </Panel>
      )}

      <p className="px-4 text-[13px] text-muted-foreground">
        <Link href="/terms" className="hover:underline">利用規約</Link>
      </p>
    </aside>
  );
}
