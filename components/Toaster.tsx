'use client';

import { useToasts } from '@/lib/toast';
import { cn } from '@/lib/utils';

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'px-4 py-2.5 rounded-full text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2',
            t.kind === 'error' ? 'bg-destructive text-white' : 'bg-foreground text-background',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
