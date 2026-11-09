'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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
    <header className={cn('sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/60', className)}>
      <div className="flex items-center gap-4 p-3 px-4 min-h-14">
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
          <h1 className="text-xl font-bold tracking-tight truncate flex items-center gap-1">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </header>
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
    <div className={cn('flex border-t border-border/40', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 py-3 text-sm font-semibold transition-colors relative whitespace-nowrap px-2',
            value === tab.id ? 'text-foreground font-bold' : 'text-muted-foreground hover:bg-accent/40',
          )}
        >
          {tab.label}
          {value === tab.id && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-full" />}
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
