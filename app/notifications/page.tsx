'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { AtSign, Bell, Heart, MessageCircle, Quote, Repeat2, SmilePlus, UserPlus } from 'lucide-react';
import { CustomEmojiImg } from '@/components/CustomEmoji';
import { InfiniteList } from '@/components/InfiniteList';
import { EmptyState, PageHeader, Tabs } from '@/components/PageHeader';
import { RichText } from '@/components/RichText';
import { UserAvatar } from '@/components/UserAvatar';
import { useInfiniteList } from '@/hooks/use-queries';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { AppNotification, NotificationType } from '@/types/post';

const TABS = [
  { id: 'all', label: 'すべて' },
  { id: 'mentions', label: 'メンション' },
] as const;

const META: Record<NotificationType, { icon: React.ReactNode; text: string }> = {
  like: { icon: <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />, text: 'さんがあなたのポストにいいねしました' },
  repost: { icon: <Repeat2 className="w-5 h-5 text-emerald-500" />, text: 'さんがあなたのポストをリポストしました' },
  quote: { icon: <Quote className="w-5 h-5 text-emerald-500" />, text: 'さんがあなたのポストを引用しました' },
  reply: { icon: <MessageCircle className="w-5 h-5 text-primary" />, text: 'さんがあなたに返信しました' },
  mention: { icon: <AtSign className="w-5 h-5 text-primary" />, text: 'さんがあなたをメンションしました' },
  follow: { icon: <UserPlus className="w-5 h-5 text-primary" />, text: 'さんにフォローされました' },
  reaction: { icon: <SmilePlus className="w-5 h-5 text-amber-500" />, text: 'さんがあなたのポストにリアクションしました' },
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('all');
  const list = useInfiniteList<AppNotification>(['notifications', tab], `/api/notifications?filter=${tab}`, { refetchInterval: 30_000 });

  // 画面を開いたら既読にする（一覧側の「未読ハイライト」は取得済みデータのまま残す）
  useEffect(() => {
    api('/api/notifications', { method: 'POST' })
      .then(() => qc.invalidateQueries({ queryKey: ['counters'] }))
      .catch(() => {});
  }, [qc]);

  return (
    <div className="min-h-screen">
      <PageHeader title="通知">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </PageHeader>

      <InfiniteList
        query={list}
        className="divide-y divide-border/60"
        empty={<EmptyState icon={<Bell className="w-6 h-6" />} title="通知はまだありません" description="いいね・返信・フォローなどがここに届きます。" />}
        render={(n) => {
          const href = n.post ? `/posts/${n.post.id}` : `/${n.actor.username}`;
          return (
            <Link href={href} className={cn('p-4 hover:bg-accent/20 transition-colors flex gap-4', !n.read && 'bg-primary/5')}>
              <div className="w-8 flex justify-end pt-1 shrink-0">{META[n.type].icon}</div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <UserAvatar user={n.actor} className="size-9" />
                <p className="text-sm">
                  <span className="font-bold">{n.actor.name}</span>
                  {n.type === 'reaction' && n.emoji ? (
                    <>
                      さんがあなたのポストに<CustomEmojiImg emoji={n.emoji} className="mx-1" />
                      でリアクションしました
                    </>
                  ) : (
                    META[n.type].text
                  )}
                  <span className="text-muted-foreground text-xs ml-2">{formatRelative(n.createdAt)}</span>
                </p>
                {n.post?.content && <RichText text={n.post.content} plain className="text-sm text-muted-foreground line-clamp-2" />}
              </div>
            </Link>
          );
        }}
      />
    </div>
  );
}
