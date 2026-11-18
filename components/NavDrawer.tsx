'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { LogIn, LogOut, X } from 'lucide-react';
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/UserAvatar';
import { UserBadges } from '@/components/UserBadges';
import { useNavItems } from '@/components/useNavItems';
import { useMe } from '@/hooks/use-queries';
import { api } from '@/lib/api';
import { setSessionUser } from '@/lib/session';
import { formatCount } from '@/lib/time';
import { cn } from '@/lib/utils';

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useNavDrawer = () => useContext(Ctx);

/** スマホ用の左スライドメニュー（X のアバターをタップすると出るやつ）。全機能への入口がここに並ぶ */
export function NavDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <DialogPrimitive.Root open={isOpen} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogOverlay className="sm:hidden bg-[#5b7083]/40 supports-backdrop-filter:backdrop-blur-none" />
          <DialogPrimitive.Popup
            aria-label="メニュー"
            className="sm:hidden fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] bg-background text-foreground flex flex-col outline-none shadow-2xl border-r border-border overflow-y-auto data-open:animate-in data-open:slide-in-from-left data-open:duration-200 data-closed:animate-out data-closed:slide-out-to-left data-closed:duration-150"
          >
            <DrawerBody onClose={() => setOpen(false)} />
          </DialogPrimitive.Popup>
        </DialogPortal>
      </DialogPrimitive.Root>
    </Ctx.Provider>
  );
}

function DrawerBody({ onClose }: { onClose: () => void }) {
  const { data: me } = useMe();
  const items = useNavItems();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();

  async function logout() {
    onClose();
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/');
    setSessionUser(qc, null);
  }

  return (
    <>
      <div className="flex items-start justify-between p-4 pb-2">
        {me ? (
          <Link href={`/${me.username}`} onClick={onClose} aria-label="プロフィール">
            <UserAvatar user={me} className="size-10" />
          </Link>
        ) : (
          <span className="text-3xl font-black text-primary leading-none pt-1">ℤ</span>
        )}
        <DialogPrimitive.Close className="p-2 -mr-2 -mt-1 rounded-full hover:bg-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="閉じる">
          <X className="w-5 h-5" />
        </DialogPrimitive.Close>
      </div>

      {me && (
        <div className="px-4 pb-3">
          <Link href={`/${me.username}`} onClick={onClose} className="block">
            <p className="font-extrabold text-xl leading-tight flex items-center gap-1">
              <span className="truncate">{me.name}</span>
              <UserBadges user={me} />
            </p>
            <p className="text-sm text-muted-foreground truncate">@{me.username}</p>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground flex gap-4">
            <Link href={`/${me.username}/following`} onClick={onClose} className="hover:underline">
              <b className="text-foreground">{formatCount(me.followingCount)}</b> フォロー中
            </Link>
            <Link href={`/${me.username}/followers`} onClick={onClose} className="hover:underline">
              <b className="text-foreground">{formatCount(me.followersCount)}</b> フォロワー
            </Link>
          </p>
        </div>
      )}

      <nav aria-label="すべての機能" className="flex-1 py-1 border-t border-border/60">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={active ? 'page' : undefined}
              className={cn('flex items-center gap-5 px-4 py-3.5 text-xl hover:bg-accent/60 transition-colors', active ? 'font-extrabold' : 'font-bold')}
            >
              <span className="relative">
                <Icon className={cn('w-6 h-6', active && 'stroke-[2.5]')} />
                {!!item.badge && <span className="absolute -top-1 -right-1.5 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-label={`未読 ${item.badge} 件`} />}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/60 py-2">
        {me ? (
          <button onClick={logout} className="w-full flex items-center gap-5 px-4 py-3.5 text-[15px] font-bold hover:bg-accent/60 transition-colors text-left">
            <LogOut className="w-5 h-5" />
            @{me.username} からログアウト
          </button>
        ) : (
          <Link href="/login" onClick={onClose} className="flex items-center gap-5 px-4 py-3.5 text-[15px] font-bold text-primary hover:bg-accent/60 transition-colors">
            <LogIn className="w-5 h-5" />
            ログイン / 新規登録
          </Link>
        )}
        <Link href="/terms" onClick={onClose} className="block px-4 py-2 text-xs text-muted-foreground hover:underline">
          利用規約
        </Link>
      </div>
    </>
  );
}
