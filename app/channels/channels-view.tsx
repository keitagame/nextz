'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Hash, Plus, Search, Users } from 'lucide-react';
import { ChannelIcon } from '@/components/ChannelIcon';
import { InfiniteList } from '@/components/InfiniteList';
import { EmptyState, PageHeader, Tabs } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useInfiniteList } from '@/hooks/use-queries';
import { api, errorMessage } from '@/lib/api';
import { countChars, MAX_CHANNEL_DESC_LENGTH, MAX_CHANNEL_NAME_LENGTH } from '@/lib/text';
import { formatCount, formatRelative } from '@/lib/time';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { Channel } from '@/types/post';

const TABS = [
  { id: 'all', label: 'すべて' },
  { id: 'joined', label: '参加中' },
] as const;

export function ChannelsView() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('all');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // 入力のたびに検索しないよう少し待つ
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const list = useInfiniteList<Channel>(['channels', tab, q], `/api/channels?scope=${tab}&q=${encodeURIComponent(q)}`);

  return (
    <div className="min-h-screen">
      <PageHeader
        title="チャンネル"
        back="/"
        right={
          <Button onClick={() => setCreateOpen(true)} className="rounded-full font-bold h-9 px-4">
            <Plus /> 作成
          </Button>
        }
      >
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </PageHeader>

      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="チャンネルを検索"
            aria-label="チャンネルを検索"
            className="pl-10 h-10 rounded-full bg-accent/50 border-none"
          />
        </div>
      </div>

      <InfiniteList
        query={list}
        render={(c) => <ChannelRow channel={c} />}
        empty={
          q ? (
            <EmptyState icon={<Search className="w-6 h-6" />} title={`「${q}」に一致するチャンネルはありません`} description="別のキーワードでお試しください。" />
          ) : tab === 'joined' ? (
            <EmptyState
              icon={<Hash className="w-6 h-6" />}
              title="参加中のチャンネルはありません"
              description="「すべて」から気になるチャンネルに参加するか、右上の「作成」で自分のチャンネルを作りましょう。"
            />
          ) : (
            <EmptyState icon={<Hash className="w-6 h-6" />} title="まだチャンネルがありません" description="右上の「作成」から、好きなことを語るチャンネルを最初に作ってみましょう。" />
          )
        }
      />

      <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ChannelRow({ channel: c }: { channel: Channel }) {
  return (
    <Link href={`/channels/${c.id}`} className="flex items-start gap-3 px-4 py-3.5 border-b border-border/60 hover:bg-accent/20 transition-colors">
      <ChannelIcon icon={c.icon} name={c.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold truncate">{c.name}</span>
          {c.isOwner ? (
            <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">管理者</span>
          ) : c.isMember ? (
            <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">参加中</span>
          ) : null}
        </div>
        {c.description && <p className="text-sm text-foreground/80 line-clamp-2 break-words mt-0.5">{c.description}</p>}
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {formatCount(c.membersCount)}人
          </span>
          <span>{c.lastPostAt ? `最終投稿 ${formatRelative(c.lastPostAt)}` : 'まだ投稿がありません'}</span>
        </p>
      </div>
    </Link>
  );
}

const ICONS = ['💬', '🎮', '🎵', '📚', '🎬', '⚽', '🍜', '☕', '🐱', '🐶', '🌸', '🎨', '💻', '✈️', '📷', '🔥'];

function CreateChannelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);

  const create = useMutation({
    mutationFn: () => api<{ channel: Channel }>('/api/channels', { method: 'POST', json: { name, description, icon } }),
    onSuccess: ({ channel }) => {
      toast('チャンネルを作成しました');
      qc.invalidateQueries({ queryKey: ['channels'] });
      onOpenChange(false);
      setName('');
      setDescription('');
      setIcon(ICONS[0]);
      router.push(`/channels/${channel.id}`);
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  const nameLen = countChars(name.trim());
  const canSubmit = nameLen > 0 && nameLen <= MAX_CHANNEL_NAME_LENGTH && countChars(description) <= MAX_CHANNEL_DESC_LENGTH && !create.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-bold">チャンネルを作成</DialogTitle>
          <DialogDescription>作成したあなたが管理者になり、メンバーのキックやチャンネルの削除ができます。</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) create.mutate();
          }}
        >
          <div>
            <p className="text-sm font-bold mb-1.5" id="icon-label">
              アイコン
            </p>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-labelledby="icon-label">
              {ICONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="radio"
                  aria-checked={icon === e}
                  onClick={() => setIcon(e)}
                  className={cn('size-10 text-xl rounded-xl hover:bg-accent transition-colors', icon === e && 'bg-primary/15 ring-2 ring-primary')}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-bold mb-1.5 flex justify-between">
              チャンネル名
              <span className={cn('font-normal text-xs', nameLen > MAX_CHANNEL_NAME_LENGTH ? 'text-destructive' : 'text-muted-foreground')}>
                {nameLen}/{MAX_CHANNEL_NAME_LENGTH}
              </span>
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault();
              }}
              placeholder="例：猫好きの集い"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold mb-1.5 flex justify-between">
              説明（任意）
              <span className={cn('font-normal text-xs', countChars(description) > MAX_CHANNEL_DESC_LENGTH ? 'text-destructive' : 'text-muted-foreground')}>
                {countChars(description)}/{MAX_CHANNEL_DESC_LENGTH}
              </span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="どんな話をするチャンネルか書きましょう"
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none resize-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <Button type="submit" disabled={!canSubmit} className="w-full h-10 rounded-full font-bold">
            {create.isPending ? '作成中...' : '作成する'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
