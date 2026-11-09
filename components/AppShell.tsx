'use client';

import { usePathname } from 'next/navigation';
import { AuthScreen } from '@/components/AuthScreen';
import { RightSidebar } from '@/components/RightSidebar';
import { Sidebar } from '@/components/Sidebar';
import { Spinner } from '@/components/PageHeader';
import { useMe } from '@/hooks/use-queries';
import { cn } from '@/lib/utils';

/** 認証ゲート + 3カラムレイアウト */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me, isPending } = useMe();
  const pathname = usePathname();

  if (isPending) return <Spinner className="py-40 w-full" />;
  if (!me) return <AuthScreen />;

  // DM 画面は広く使いたいので右サイドバーを出さない
  const wide = pathname.startsWith('/messages');

  return (
    <div className="flex w-full max-w-7xl justify-between min-h-screen">
      <Sidebar />
      <main className={cn('flex-1 border-r min-h-screen pb-16 sm:pb-0 min-w-0', !wide && 'max-w-[600px]')}>{children}</main>
      {!wide && <RightSidebar />}
    </div>
  );
}
