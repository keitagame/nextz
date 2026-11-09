'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UserListItem } from '@/components/UserListItem';
import { api } from '@/lib/api';
import { formatCount } from '@/lib/time';
import type { Trend, UserSummary } from '@/types/post';

export function RightSidebar() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const trends = useQuery({ queryKey: ['trends'], queryFn: () => api<{ items: Trend[] }>('/api/trends'), staleTime: 60_000 });
  const suggestions = useQuery({ queryKey: ['suggestions', 3], queryFn: () => api<{ items: UserSummary[] }>('/api/suggestions?limit=3'), staleTime: 60_000 });

  return (
    <aside className="hidden md:block w-[280px] lg:w-[350px] p-4 space-y-4 sticky top-0 h-screen overflow-y-auto shrink-0">
      <form
        role="search"
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/explore?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="キーワード検索" aria-label="キーワード検索" className="pl-9 h-10 rounded-full bg-muted border-none" />
      </form>

      <Card className="border-none shadow-none bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold">いまどうなってる？</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {trends.data?.items.length === 0 && <p className="text-sm text-muted-foreground p-2">トレンドはまだありません。#ハッシュタグ付きでポストしてみましょう。</p>}
          {trends.data?.items.slice(0, 5).map((t) => (
            <Link key={t.tag} href={`/explore?q=${encodeURIComponent(`#${t.tag}`)}`} className="block hover:bg-muted/80 p-2 rounded-lg transition-colors">
              <p className="text-xs text-muted-foreground">トレンド</p>
              <p className="font-bold text-sm">#{t.tag}</p>
              <p className="text-xs text-muted-foreground">{formatCount(t.postsCount)} 件のポスト</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      {suggestions.data && suggestions.data.items.length > 0 && (
        <Card className="border-none shadow-none bg-muted/50">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg font-bold">おすすめユーザー</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {suggestions.data.items.map((u) => (
              <UserListItem key={u.id} user={u} compact />
            ))}
          </CardContent>
        </Card>
      )}
    </aside>
  );
}
