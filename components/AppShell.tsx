'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthScreen } from '@/components/AuthScreen';
import { NavDrawerProvider } from '@/components/NavDrawer';
import { RightSidebar } from '@/components/RightSidebar';
import { Sidebar } from '@/components/Sidebar';
import { Spinner } from '@/components/PageHeader';
import { useMe } from '@/hooks/use-queries';
import { cn } from '@/lib/utils';

/** ログインしないと使えないページ（ゲストが開いたらログイン画面を出す） */
const PRIVATE_PREFIXES = ['/notifications', '/bookmarks', '/settings', '/admin', '/profile'];
const isPrivatePath = (p: string) => PRIVATE_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));

/** X 風の3カラム（左：全機能のナビ / 中：画面 / 右：検索・トレンド）。閲覧はログイン不要。ログインが要るページだけ認証画面を出す */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me, isPending } = useMe();
  const pathname = usePathname();
  const router = useRouter();

  // ログイン済みで /login を開いたらホームへ
  const redirectHome = !!me && pathname === '/login';
  useEffect(() => {
    if (redirectHome) router.replace('/');
  }, [redirectHome, router]);

  if (isPending || redirectHome) return <Spinner className="py-40 w-full" />;
  if (!me && (pathname === '/login' || isPrivatePath(pathname))) return <AuthScreen />;


  return (
    <NavDrawerProvider>
      <div className="flex w-full max-w-7xl justify-center min-h-screen">
        <Sidebar />
        <main className={'flex-1 sm:border-x min-h-screen pb-16 sm:pb-0 min-w-0 max-w-[600px]'}>{children}</main>
        <RightSidebar />
      </div>
    </NavDrawerProvider>
  );
}
