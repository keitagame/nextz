'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Menu } from 'lucide-react';
import { useNavDrawer } from '@/components/NavDrawer';
import { UserAvatar } from '@/components/UserAvatar';
import { useMe } from '@/hooks/use-queries';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  subtitle,
  back,
  right,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: boolean | string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <header className={cn('sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border', className)}>
      <div className="flex items-center gap-4 px-4 min-h-[53px]">
        {!back && <MenuButton />}
        {back &&
          (typeof back === 'string' ? (
            <Link href={back} className="p-2 -ml-2 rounded-full hover:bg-accent transition-colors" aria-label="戻る">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          ) : (
            <button
              onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
              className="p-2 -ml-2 rounded-full hover:bg-accent transition-colors"
              aria-label="戻る"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ))}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight truncate flex items-center gap-1">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </header>
  );
}

/** スマホ専用：アバター（ゲストはメニューアイコン）をタップして、全機能が並ぶドロワーを開く */
export function MenuButton({ className }: { className?: string }) {
  const { open } = useNavDrawer();
  const { data: me } = useMe();
  return (
    <button onClick={open} className={cn('sm:hidden -ml-1 rounded-full shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} aria-label="メニューを開く">
      {me ? <UserAvatar user={me} className="size-8" /> : <Menu className="w-6 h-6" />}
    </button>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 h-[53px] text-[15px] transition-colors whitespace-nowrap px-2 outline-none hover:bg-accent/50 focus-visible:bg-accent/50',
            value === tab.id ? 'text-foreground font-extrabold' : 'text-muted-foreground font-medium',
          )}
        >
          <span className="relative inline-flex h-full items-center">
            {tab.label}
            {value === tab.id && <span className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex justify-center py-8', className)} role="status" aria-label="読み込み中">
      <div className="size-6 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon?: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="p-12 text-center space-y-3">
      {icon && <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">{icon}</div>}
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="text-sm text-muted-foreground max-w-xs mx-auto">{description}</p>}
    </div>
  );
}
