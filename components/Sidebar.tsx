'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Bookmark, Hash, Home, LogOut, Mail, MoreHorizontal, Newspaper, PenSquare, Search, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/UserAvatar';
import { useCompose } from '@/components/ComposeProvider';
import { useCounters, useViewer } from '@/hooks/use-queries';
import { api } from '@/lib/api';
import { setSessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';

/** スマホの下部ナビに出す項目 */
const MOBILE_LABELS = ['ホーム', '通知', 'メッセージ', 'プロフィール'];

export function Sidebar() {
  const me = useViewer();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { open } = useCompose();
  const { data: counters } = useCounters();

  const items = [
    { icon: Home, label: 'ホーム', href: '/', match: (p: string) => p === '/' },
    { icon: Newspaper, label: 'タイムライン', href: '/timeline', match: (p: string) => p.startsWith('/timeline') },
    { icon: Hash, label: 'チャンネル', href: '/channels', match: (p: string) => p.startsWith('/channels') },
    { icon: Search, label: '話題を検索', href: '/explore', match: (p: string) => p.startsWith('/explore') },
    { icon: Bell, label: '通知', href: '/notifications', match: (p: string) => p.startsWith('/notifications'), badge: counters?.notifications },
    { icon: Mail, label: 'メッセージ', href: '/messages', match: (p: string) => p.startsWith('/messages'), badge: counters?.messages },
    { icon: Bookmark, label: 'ブックマーク', href: '/bookmarks', match: (p: string) => p.startsWith('/bookmarks') },
    { icon: User, label: 'プロフィール', href: `/${me.username}`, match: (p: string) => p === `/${me.username}` || p.startsWith(`/${me.username}/`) },
  ];

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/');
    setSessionUser(qc, null);
  }

  const Badge = ({ n }: { n?: number }) =>
    n ? (
      <span className="absolute -top-0.5 left-6 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
        {n > 99 ? '99+' : n}
      </span>
    ) : null;

  return (
    <>
      {/* PC・タブレット向け：左サイドバー */}
      <aside className="hidden sm:flex flex-col justify-between h-screen sticky top-0 p-3 lg:p-4 border-r w-[80px] lg:w-[240px] shrink-0">
        <div className="space-y-4">
          <Link href="/" className="block px-3 py-2 text-3xl font-bold tracking-wider text-primary w-fit" aria-label="ホーム">
            ℤ
          </Link>

          <nav className="space-y-1" aria-label="メインナビゲーション">
            {items.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex items-center gap-4 px-3 py-3 text-lg rounded-full hover:bg-accent transition-colors w-fit lg:w-full', active && 'font-bold')}
                >
                  <span className="relative">
                    <Icon className={cn('w-6 h-6 shrink-0', active && 'stroke-[2.5]')} />
                    <Badge n={item.badge} />
                  </span>
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Button onClick={() => open()} className="w-full rounded-full h-12 text-base font-bold shadow-md">
            <PenSquare className="w-5 h-5 lg:hidden" />
            <span className="hidden lg:inline">投稿する</span>
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 p-2 rounded-full hover:bg-accent cursor-pointer outline-none w-full text-left">
            <UserAvatar user={me} />
            <div className="hidden lg:block overflow-hidden flex-1">
              <p className="text-sm font-bold truncate">{me.name}</p>
              <p className="text-xs text-muted-foreground truncate">@{me.username}</p>
            </div>
            <MoreHorizontal className="hidden lg:block w-4 h-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings /> 設定
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut /> @{me.username} からログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>

      {/* スマホ向け：下部ナビは4つだけ（そのほかの機能はホームの機能一覧から開く）。投稿ボタンはタイムラインだけに出す */}
      {pathname.startsWith('/timeline') && (
        <button
          onClick={() => open()}
          className="sm:hidden fixed right-4 bottom-20 z-40 size-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label="投稿する"
        >
          <PenSquare className="w-6 h-6" />
        </button>
      )}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t flex p-1 z-50" aria-label="メインナビゲーション">
        {items
          .filter((item) => MOBILE_LABELS.includes(item.label))
          .map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn('flex-1 flex justify-center py-3 hover:bg-accent rounded-full relative', active && 'text-primary')}
              >
                <span className="relative">
                  <Icon className={cn('w-6 h-6', active && 'stroke-[2.5]')} />
                  <Badge n={item.badge} />
                </span>
              </Link>
            );
          })}
      </nav>
    </>
  );
}
