'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Hash, LogOut, MoreHorizontal, Trash2, UserMinus, Users } from 'lucide-react';
import { ChannelIcon } from '@/components/ChannelIcon';
import { CreatePostForm } from '@/components/CreatePostForm';
import { InfiniteList } from '@/components/InfiniteList';
import { EmptyState, PageHeader, Spinner } from '@/components/PageHeader';
import { PostCard } from '@/components/PostCard';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useChannelAdmin } from '@/hooks/use-channel-admin';
import { useInfiniteList, useViewer } from '@/hooks/use-queries';
import { api, errorMessage } from '@/lib/api';
import { formatFull } from '@/lib/time';
import { toast, toastError } from '@/lib/toast';
import type { Channel, ChannelMember, FeedItem } from '@/types/post';

export function ChannelView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [membersOpen, setMembersOpen] = useState(false);

  const channelQ = useQuery({
    queryKey: ['channel', id],
    queryFn: async () => (await api<{ channel: Channel }>(`/api/channels/${id}`)).channel,
    refetchInterval: 30_000,
  });
  const channel = channelQ.data;
  const posts = useInfiniteList<FeedItem>(['channel-posts', id], `/api/channels/${id}/posts`, { enabled: !!channel, refetchInterval: 10_000 });

  const setChannel = (c: Channel) => {
    qc.setQueryData(['channel', id], c);
    qc.invalidateQueries({ queryKey: ['channels'] });
    qc.invalidateQueries({ queryKey: ['channel-members', id] });
  };
  const join = useMutation({
    mutationFn: () => api<{ channel: Channel }>(`/api/channels/${id}/members`, { method: 'POST' }),
    onSuccess: ({ channel }) => {
      setChannel(channel);
      toast('チャンネルに参加しました');
    },
    onError: (e) => toastError(errorMessage(e)),
  });
  const leave = useMutation({
    mutationFn: () => api<{ channel: Channel }>(`/api/channels/${id}/members`, { method: 'DELETE' }),
    onSuccess: ({ channel }) => {
      setChannel(channel);
      toast('チャンネルから退出しました');
    },
    onError: (e) => toastError(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/api/channels/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('チャンネルを削除しました');
      qc.removeQueries({ queryKey: ['channel', id] });
      qc.removeQueries({ queryKey: ['channel-posts', id] });
      qc.invalidateQueries({ queryKey: ['channels'] });
      router.push('/channels');
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  if (channelQ.isPending) return <Spinner className="py-20" />;
  if (channelQ.isError || !channel) {
    return (
      <div>
        <PageHeader title="チャンネル" back="/channels" />
        <EmptyState icon={<Hash className="w-6 h-6" />} title="チャンネルが見つかりません" description="削除されたか、URL が正しくない可能性があります。" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        back="/channels"
        title={<span className="truncate">{channel.name}</span>}
        subtitle={`${channel.membersCount}人のメンバー`}
        right={
          <DropdownMenu>
            <DropdownMenuTrigger className="p-2 rounded-full hover:bg-accent transition-colors outline-none" aria-label="チャンネルのメニュー">
              <MoreHorizontal className="w-5 h-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setMembersOpen(true)}>
                <Users /> メンバー{channel.isOwner ? 'を管理' : 'を見る'}
              </DropdownMenuItem>
              {channel.isMember && !channel.isOwner && (
                <DropdownMenuItem
                  onClick={() => {
                    if (confirm('このチャンネルから退出しますか？')) leave.mutate();
                  }}
                >
                  <LogOut /> 退出する
                </DropdownMenuItem>
              )}
              {channel.isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`チャンネル「${channel.name}」を削除しますか？\nすべての投稿とメンバー情報が消え、元に戻せません。`)) remove.mutate();
                    }}
                  >
                    <Trash2 /> チャンネルを削除
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <section className="p-4 border-b border-border/60 space-y-3">
        <div className="flex items-start gap-3">
          <ChannelIcon icon={channel.icon} name={channel.name} className="size-14 text-3xl rounded-3xl" />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg leading-tight break-words">{channel.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              管理者{' '}
              <Link href={`/${channel.owner.username}`} className="text-primary hover:underline">
                @{channel.owner.username}
              </Link>
              ・{formatFull(channel.createdAt).replace(/ .*$/, '')}に作成
            </p>
          </div>
        </div>
        {channel.description && <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{channel.description}</p>}

        {channel.isBanned ? (
          <p className="flex items-center gap-2 text-sm rounded-xl bg-destructive/10 text-destructive p-3">
            <Ban className="w-4 h-4 shrink-0" />
            管理者にキックされているため、このチャンネルには参加・投稿できません。
          </p>
        ) : channel.isOwner ? (
          <p className="text-xs text-muted-foreground">あなたはこのチャンネルの管理者です。メンバーのキックやチャンネルの削除ができます。</p>
        ) : !channel.isMember ? (
          <Button onClick={() => join.mutate()} disabled={join.isPending} className="w-full h-10 rounded-full font-bold">
            {join.isPending ? '参加中...' : 'チャンネルに参加する'}
          </Button>
        ) : null}
      </section>

      {channel.isMember && <CreatePostForm channelId={id} />}

      <InfiniteList
        query={posts}
        render={(item) => <PostCard post={item.post} repostedBy={item.repostedBy} hideChannel />}
        empty={
          <EmptyState
            icon={<Hash className="w-6 h-6" />}
            title="まだ投稿がありません"
            description={channel.isMember ? '最初の投稿をして、チャンネルを盛り上げましょう。' : '参加すると投稿できます。'}
          />
        }
      />

      <MembersDialog channel={channel} open={membersOpen} onOpenChange={setMembersOpen} />
    </div>
  );
}

function MembersDialog({ channel, open, onOpenChange }: { channel: Channel; open: boolean; onOpenChange: (o: boolean) => void }) {
  const me = useViewer();
  const admin = useChannelAdmin(channel.id);
  const q = useQuery({
    queryKey: ['channel-members', channel.id],
    queryFn: () => api<{ members: ChannelMember[]; banned: ChannelMember[] }>(`/api/channels/${channel.id}/members`),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-bold">メンバー（{channel.membersCount}人）</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-2">
          {q.isPending && <Spinner className="py-6" />}
          {q.isError && <p className="p-4 text-sm text-muted-foreground text-center">{q.error.message}</p>}
          {q.data?.members.map((m) => (
            <div key={m.user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/40">
              <Link href={`/${m.user.username}`} onClick={() => onOpenChange(false)} className="flex items-center gap-3 flex-1 min-w-0">
                <UserAvatar user={m.user} />
                <span className="min-w-0">
                  <span className="font-bold text-sm flex items-center gap-1.5">
                    <span className="truncate">{m.user.name}</span>
                    {m.isOwner && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">管理者</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">@{m.user.username}</span>
                </span>
              </Link>
              {channel.isOwner && !m.isOwner && m.user.id !== me.id && (
                <Button variant="outline" size="sm" onClick={() => admin.kick(m.user)} className="shrink-0 text-destructive">
                  <UserMinus /> キック
                </Button>
              )}
            </div>
          ))}

          {channel.isOwner && !!q.data?.banned.length && (
            <>
              <p className="px-2 pt-4 pb-1 text-xs font-bold text-muted-foreground">キックしたユーザー（再参加できません）</p>
              {q.data.banned.map((m) => (
                <div key={m.user.id} className="flex items-center gap-3 p-2 rounded-lg">
                  <UserAvatar user={m.user} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-sm truncate">{m.user.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">@{m.user.username}</span>
                  </span>
                  <Button variant="outline" size="sm" onClick={() => admin.unban(m.user)} className="shrink-0">
                    解除
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
