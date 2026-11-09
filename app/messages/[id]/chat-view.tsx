'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { EmptyState, Spinner } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { formatClock } from '@/lib/time';
import { MAX_DM_LENGTH } from '@/lib/text';
import { toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { DmMessage, User } from '@/types/post';

interface ChatData {
  other: User;
  messages: DmMessage[];
}

export function ChatView() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const chat = useQuery({
    queryKey: ['dm', id],
    queryFn: () => api<ChatData>(`/api/dm/${id}`),
    refetchInterval: 4000,
    staleTime: 0,
  });

  // 開いた/受信した時点でサーバー側が既読にするので、未読バッジを更新する
  const lastId = chat.data?.messages.at(-1)?.id;
  useEffect(() => {
    if (lastId) qc.invalidateQueries({ queryKey: ['counters'] });
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [lastId, qc]);

  const send = useMutation({
    mutationFn: (body: string) => api<{ message: DmMessage }>(`/api/dm/${id}`, { method: 'POST', json: { body } }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ['dm', id] });
      const temp: DmMessage = { id: `tmp-${Date.now()}`, mine: true, body, createdAt: new Date().toISOString() };
      qc.setQueryData<ChatData>(['dm', id], (d) => (d ? { ...d, messages: [...d.messages, temp] } : d));
    },
    onError: (e, body) => {
      setText(body);
      toastError(errorMessage(e));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['dm', id] });
      qc.invalidateQueries({ queryKey: ['dm-threads'] });
    },
  });

  function submit() {
    const body = text.trim();
    if (!body || send.isPending) return;
    setText('');
    send.mutate(body);
  }

  if (chat.isPending) return <Spinner className="py-20" />;
  if (chat.isError) return <EmptyState title="会話が見つかりません" description={chat.error.message} />;
  const { other, messages } = chat.data;

  return (
    <>
      <header className="p-3 px-4 border-b border-border/60 flex items-center gap-3 bg-background/80 backdrop-blur-md min-h-14">
        <Link href="/messages" className="sm:hidden p-2 -ml-2 rounded-full hover:bg-accent" aria-label="会話一覧へ戻る">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Link href={`/${other.username}`} className="flex items-center gap-3 min-w-0">
          <UserAvatar user={other} className="size-9" />
          <div className="min-w-0">
            <p className="font-bold text-sm leading-none truncate">{other.name}</p>
            <p className="text-xs text-muted-foreground">@{other.username}</p>
          </div>
        </Link>
      </header>

      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-accent/5">
        {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">最初のメッセージを送りましょう</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]',
                m.mine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-accent text-foreground rounded-bl-md',
              )}
            >
              {m.body}
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 px-1">{formatClock(m.createdAt)}</span>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form
        className="p-3 border-t border-border/60 bg-background flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          // 日本語入力の変換確定の Enter では送信しない
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.nativeEvent.isComposing) e.stopPropagation();
          }}
          maxLength={MAX_DM_LENGTH}
          placeholder="新しいメッセージを入力..."
          aria-label="メッセージ"
          className="flex-1 h-10 rounded-full bg-accent/40 border-none"
        />
        <button type="submit" disabled={!text.trim()} className="p-2.5 bg-primary text-primary-foreground rounded-full hover:opacity-90 disabled:opacity-40" aria-label="送信">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </>
  );
}
