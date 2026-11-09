'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SquarePen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeader, Spinner } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { api, errorMessage } from '@/lib/api';
import { formatRelative } from '@/lib/time';
import { toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { DmThread, Page, UserSummary } from '@/types/post';

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inThread = pathname !== '/messages';
  const [composeOpen, setComposeOpen] = useState(false);
  const threads = useQuery({ queryKey: ['dm-threads'], queryFn: () => api<{ items: DmThread[] }>('/api/dm'), refetchInterval: 10_000 });

  return (
    <div className="h-[calc(100dvh-4rem)] sm:h-screen flex">
      <div className={cn('w-full sm:w-80 sm:border-r border-border/60 flex-col shrink-0', inThread ? 'hidden sm:flex' : 'flex')}>
        <PageHeader
          title="メッセージ"
          right={
            <button onClick={() => setComposeOpen(true)} className="p-2 rounded-full hover:bg-accent" aria-label="新しいメッセージ" title="新しいメッセージ">
              <SquarePen className="w-5 h-5" />
            </button>
          }
        />
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {threads.isPending && <Spinner />}
          {threads.data?.items.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">会話はまだありません。右上のボタンから新しいメッセージを送りましょう。</p>
          )}
          {threads.data?.items.map((t) => {
            const active = pathname === `/messages/${t.id}`;
            return (
              <Link key={t.id} href={`/messages/${t.id}`} className={cn('p-3.5 flex items-center gap-3 hover:bg-accent/40 transition-colors', active && 'bg-accent/60')}>
                <UserAvatar user={t.other} className="size-11" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <p className="font-bold text-sm truncate">{t.other.name}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0">{formatRelative(t.updatedAt)}</span>
                  </div>
                  <p className={cn('text-xs truncate', t.unreadCount ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                    {t.lastMessage ? `${t.lastMessage.mine ? 'あなた: ' : ''}${t.lastMessage.body}` : ''}
                  </p>
                </div>
                {t.unreadCount > 0 && <span className="size-2.5 rounded-full bg-primary shrink-0" aria-label="未読" />}
              </Link>
            );
          })}
        </div>
      </div>

      <div className={cn('flex-1 min-w-0 flex-col', inThread ? 'flex' : 'hidden sm:flex')}>{children}</div>

      <NewMessageDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </div>
  );
}

function NewMessageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const term = q.trim();
  const results = useQuery({
    queryKey: ['search', 'dm-users', term],
    queryFn: () => api<Page<UserSummary>>(`/api/search?type=users&q=${encodeURIComponent(term)}`),
    enabled: term.length > 0,
  });
  const start = useMutation({
    mutationFn: (username: string) => api<{ id: string }>('/api/dm', { method: 'POST', json: { username } }),
    onSuccess: ({ id }) => {
      onOpenChange(false);
      setQ('');
      router.push(`/messages/${id}`);
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-bold">新しいメッセージ</DialogTitle>
        </DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ユーザーを検索" autoFocus aria-label="ユーザーを検索" />
        <div className="max-h-72 overflow-y-auto -mx-2">
          {results.isFetching && <Spinner className="py-4" />}
          {results.data?.items.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">見つかりませんでした</p>}
          {results.data?.items.map((u) => (
            <button key={u.id} onClick={() => start.mutate(u.username)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent text-left">
              <UserAvatar user={u} />
              <span className="min-w-0">
                <span className="block font-bold text-sm truncate">{u.name}</span>
                <span className="block text-xs text-muted-foreground">@{u.username}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
