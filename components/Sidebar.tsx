'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { LogIn, LogOut, MoreHorizontal, PenSquare } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/UserAvatar';
import { UserBadges } from '@/components/UserBadges';
import { useCompose } from '@/components/ComposeProvider';
import { useNavItems, type NavItem } from '@/components/useNavItems';
import { useMe } from '@/hooks/use-queries';
import { api } from '@/lib/api';
import { setSessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';

function Badge({ n, className }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span
      className={cn('absolute -top-1.5 left-3 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center ring-2 ring-background', className)}
      aria-label={`未読 ${n} 件`}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

/** PC・タブレットは左サイドバー、スマホは下部ナビ（それ以外の機能はヘッダーのアイコンから開くドロワー） */
export function Sidebar() {
  const { data: me } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { open } = useCompose();
  const items = useNavItems();

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/');
    setSessionUser(qc, null);
  }

  const barItems = items.filter((i) => i.inBar);

  return (
    <>
      {/* PC・タブレット：全機能がここに並ぶ（機能一覧ページはない） */}
      <aside className="hidden sm:flex flex-col justify-between h-screen sticky top-0 px-2 lg:px-3 py-1 w-[80px] lg:w-[260px] shrink-0 overflow-y-auto">
        <div>
          <Link
            href="/"
            className="flex size-[52px] items-center justify-center rounded-full text-[34px] font-black leading-none text-foreground hover:bg-accent transition-colors"
            aria-label="Z ホーム"
          >
            ℤ
          </Link>

          <nav className="mt-1" aria-label="メインナビゲーション">
            {items.map((item) => (
              <SideLink key={item.href} item={item} active={item.match(pathname)} />
            ))}
          </nav>

          {me ? (
            <button
              onClick={() => open()}
              aria-label="ポストする"
              className="mt-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 active:scale-[0.98] transition-all size-[52px] lg:w-[90%] outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
            >
              <PenSquare className="w-6 h-6 lg:hidden" />
              <span className="hidden lg:inline text-[17px]">ポストする</span>
            </button>
          ) : (
            <Link
              href="/login"
              aria-label="ログイン・新規登録"
              className={cn(buttonVariants(), 'mt-4 flex items-center justify-center rounded-full font-bold size-[52px] lg:w-[90%] lg:h-[52px] text-[17px]')}
            >
              <LogIn className="w-6 h-6 lg:hidden" />
              <span className="hidden lg:inline">ログイン / 新規登録</span>
            </Link>
          )}
        </div>

        <div className="py-3">
          {me ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-3 p-3 rounded-full hover:bg-accent cursor-pointer outline-none w-full text-left transition-colors">
                <UserAvatar user={me} />
                <div className="hidden lg:block overflow-hidden flex-1">
                  <p className="text-[15px] font-bold truncate flex items-center gap-1">
                    <span className="truncate">{me.name}</span>
                    <UserBadges user={me} />
                  </p>
                  <p className="text-[15px] text-muted-foreground truncate">@{me.username}</p>
                </div>
                <MoreHorizontal className="hidden lg:block w-5 h-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-64">
                <DropdownMenuItem onClick={logout}>
                  <LogOut /> @{me.username} からログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <p className="hidden lg:block px-3 text-xs text-muted-foreground leading-relaxed">ログインなしで閲覧中です。ポストやいいねをするにはログインしてください。</p>
          )}
        </div>
      </aside>

      {/* スマホ：ポストボタン（ホームだけ） */}
      {me && pathname === '/' && (
        <button
          onClick={() => open()}
          className="sm:hidden fixed right-4 bottom-[72px] z-40 size-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label="ポストする"
        >
          <PenSquare className="w-6 h-6" />
        </button>
      )}

      {/* スマホ：下部ナビ */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur border-t flex z-30 pb-[env(safe-area-inset-bottom)]" aria-label="メインナビゲーション">
        {barItems.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={cn('flex-1 flex justify-center py-3.5 relative transition-colors', active ? 'text-foreground' : 'text-muted-foreground')}
            >
              <span className="relative">
                <Icon className={cn('w-[26px] h-[26px]', active && 'stroke-[2.6]')} />
                <Badge n={item.badge} className="left-3" />
              </span>
            </Link>
          );
        })}
        {!me && (
          <Link href="/login" aria-label="ログイン" className="flex-1 flex justify-center py-3.5 text-primary">
            <LogIn className="w-[26px] h-[26px]" />
          </Link>
        )}
      </nav>
    </>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
      className={cn(
        'group flex items-center gap-5 w-fit lg:w-fit lg:pr-7 p-3 rounded-full text-xl hover:bg-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'font-extrabold' : 'font-normal',
      )}
    >
      <span className="relative">
        <Icon className={cn('w-[26px] h-[26px] shrink-0', active && 'stroke-[2.6]')} />
        <Badge n={item.badge} />
      </span>
      <span className="hidden lg:inline">{item.label}</span>
    </Link>
  );
}
