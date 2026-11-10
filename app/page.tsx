'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bell, Bookmark, Compass, Hash, Mail, Newspaper, Search, Settings, ShieldAlert, User, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageHeader, Spinner } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { UserBadges } from '@/components/UserBadges';
import { useCounters, useViewer } from '@/hooks/use-queries';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { ActiveUser } from '@/types/post';

interface Feature {
  icon: LucideIcon;
  label: string;
  description: string;
  href: string;
  badge?: number;
}

/** ホーム：検索窓 / 機能一覧 / アクティブユーザー一覧（タイムラインは「タイムライン」として機能一覧から開く） */
export default function HomePage() {
  const me = useViewer();
  const router = useRouter();
  const [q, setQ] = useState('');
  const { data: counters } = useCounters();
  const active = useQuery({
    queryKey: ['active-users'],
    queryFn: () => api<{ items: ActiveUser[] }>('/api/users/active'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const features: Feature[] = [
    { icon: Newspaper, label: 'タイムライン', description: 'みんなの投稿', href: '/timeline' },
    { icon: Hash, label: 'チャンネル', description: '好きを語るコミュニティ', href: '/channels' },
    { icon: Compass, label: '話題を探す', description: 'トレンドとおすすめ', href: '/explore' },
    { icon: Bell, label: '通知', description: 'いいね・返信など', href: '/notifications', badge: counters?.notifications },
    { icon: Mail, label: 'メッセージ', description: '1対1でやりとりする', href: '/messages', badge: counters?.messages },
    { icon: Bookmark, label: 'ブックマーク', description: '保存したポスト', href: '/bookmarks' },
    { icon: User, label: 'プロフィール', description: '自分のページ', href: `/${me.username}` },
    { icon: Settings, label: '設定', description: 'アカウント・絵文字', href: '/settings' },
    ...(me.viewerIsAdmin ? [{ icon: ShieldAlert, label: '管理', description: '凍結（BAN）と解除', href: '/admin' }] : []),
  ];

  return (
    <div className="min-h-screen">
      <PageHeader title="ホーム" />

      <form
        role="search"
        className="p-4 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = q.trim();
          router.push(v ? `/explore?q=${encodeURIComponent(v)}` : '/explore');
        }}
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            // 日本語入力の変換確定の Enter では検索しない
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault();
            }}
            placeholder="キーワード・#タグ・@ユーザー"
            aria-label="検索"
            enterKeyHint="search"
            className="pl-10 h-12 rounded-full bg-accent/50 border-none text-base"
          />
        </div>
      </form>

      <section aria-labelledby="features-title" className="p-4">
        <h2 id="features-title" className="font-bold text-lg mb-3">
          機能
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, label, description, href, badge }) => (
            <Link
              key={href}
              href={href}
              className="relative rounded-2xl border border-border/60 p-3 flex flex-col gap-1.5 hover:bg-accent/30 active:bg-accent/50 transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <span className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="font-bold text-[15px] truncate">{label}</span>
              </span>
              <span className="block text-xs text-muted-foreground leading-snug">{description}</span>
              {!!badge && (
                <span
                  className="absolute top-2.5 right-2.5 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center"
                  aria-label={`未読 ${badge} 件`}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="active-title" className="border-t border-border/60">
        <h2 id="active-title" className="font-bold text-lg p-4 pb-2 flex items-center gap-2">
          アクティブなユーザー
          {!!active.data?.items.length && <span className="text-sm font-normal text-muted-foreground">{active.data.items.length}人</span>}
        </h2>
        {active.isPending ? (
          <Spinner />
        ) : active.isError ? (
          <p className="px-4 pb-6 text-sm text-muted-foreground">読み込めませんでした。時間をおいてお試しください。</p>
        ) : active.data.items.length === 0 ? (
          <p className="px-4 pb-6 text-sm text-muted-foreground">いまアクティブなユーザーはいません。直近5分以内にアプリを開いた人がここに表示されます。</p>
        ) : (
          <ul className="pb-4">
            {active.data.items.map((u) => (
              <li key={u.id}>
                <Link href={`/${u.username}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors">
                  <span className="relative shrink-0">
                    <UserAvatar user={u} className="size-11" />
                    <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-background" aria-hidden />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-bold text-sm flex items-center gap-1">
                      <span className="truncate">{u.name}</span>
                      <UserBadges user={u} />
                    </span>
                    <span className="block text-xs text-muted-foreground truncate">@{u.username}</span>
                  </span>
                  <span className={cn('text-xs shrink-0 text-emerald-600 dark:text-emerald-400')}>{formatRelative(u.lastSeenAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
