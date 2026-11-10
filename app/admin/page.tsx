'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban, ShieldCheck, ShieldOff } from 'lucide-react';
import { BanDialog, useUnban } from '@/components/BanDialog';
import { InfiniteList } from '@/components/InfiniteList';
import { EmptyState, PageHeader, Tabs } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInfiniteList, useViewer } from '@/hooks/use-queries';
import { formatFull, formatRelative } from '@/lib/time';
import type { AdminUser } from '@/types/post';

type Filter = 'all' | 'banned';

const Tag = ({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'danger' }) => (
  <span className={tone === 'danger' ? 'bg-destructive/15 text-destructive px-1.5 py-0.5 rounded text-[10px] font-bold' : 'bg-muted px-1.5 py-0.5 rounded text-[10px] font-bold'}>{children}</span>
);

/** 管理者専用：ユーザーの検索と、アカウントの凍結（BAN）・解除 */
export default function AdminPage() {
  const me = useViewer();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [target, setTarget] = useState<{ username: string; name: string } | null>(null);
  const unban = useUnban();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams();
  if (debounced) params.set('q', debounced);
  if (filter === 'banned') params.set('filter', 'banned');
  const list = useInfiniteList<AdminUser>(['admin-users', debounced, filter], `/api/admin/users?${params}`, { enabled: me.viewerIsAdmin });

  if (!me.viewerIsAdmin) {
    return (
      <>
        <PageHeader title="管理" back />
        <EmptyState icon={<ShieldOff className="w-6 h-6" />} title="このページを表示する権限がありません" description="管理者のアカウントでログインしてください。" />
      </>
    );
  }

  const tabs = [
    { id: 'all', label: 'すべてのユーザー' },
    { id: 'banned', label: '凍結中' },
  ] as const;

  return (
    <div className="min-h-screen pb-16">
      <PageHeader title="管理" subtitle="アカウントの凍結（BAN）と解除" back="/">
        <Tabs tabs={tabs} value={filter} onChange={setFilter} />
      </PageHeader>

      <div className="p-4 pb-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ユーザー名・表示名で検索" aria-label="ユーザーを検索" className="h-10" />
      </div>

      <InfiniteList
        query={list}
        className="divide-y divide-border/60"
        empty={<EmptyState icon={<ShieldCheck className="w-6 h-6" />} title={filter === 'banned' ? '凍結中のアカウントはありません' : 'ユーザーが見つかりません'} />}
        render={(u) => (
          <div className="flex items-start gap-3 px-4 py-3">
            <Link href={`/${u.username}`} className="shrink-0" aria-label={`${u.name}のプロフィール`}>
              <UserAvatar user={u} className="size-11" />
            </Link>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href={`/${u.username}`} className="font-bold text-sm hover:underline truncate max-w-full">{u.name}</Link>
                <span className="text-xs text-muted-foreground">@{u.username}</span>
                {u.isBot && <Tag>BOT</Tag>}
                {u.isAdmin && <Tag>管理者</Tag>}
                {u.bannedAt && <Tag tone="danger">凍結中</Tag>}
              </div>
              <p className="text-xs text-muted-foreground">
                登録 {formatRelative(u.createdAt)}・{u.termsVersion ? `利用規約 ${u.termsVersion} に同意` : '規約への同意の記録なし'}
              </p>
              {u.bannedAt && (
                <div className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs space-y-0.5">
                  <p className="whitespace-pre-wrap break-words"><span className="font-bold">理由：</span>{u.banReason}</p>
                  <p className="text-muted-foreground">{formatFull(u.bannedAt)}{u.bannedBy ? ` に @${u.bannedBy} が凍結` : ''}</p>
                </div>
              )}
            </div>
            {!u.isAdmin && u.username !== me.username &&
              (u.bannedAt ? (
                <Button variant="outline" size="sm" className="rounded-full shrink-0" onClick={() => unban(u.username)}>解除</Button>
              ) : (
                <Button variant="destructive" size="sm" className="rounded-full shrink-0" onClick={() => setTarget({ username: u.username, name: u.name })}>
                  <Ban /> 凍結
                </Button>
              ))}
          </div>
        )}
      />

      <BanDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
