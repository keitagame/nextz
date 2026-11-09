'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Hash, ImagePlus, LogOut, MoreHorizontal, Trash2, UserMinus, Users, X } from 'lucide-react';
import { ChannelIcon } from '@/components/ChannelIcon';
import { ImageGrid } from '@/components/ImageGrid';
import { InfiniteList } from '@/components/InfiniteList';
import { EmptyState, PageHeader, Spinner } from '@/components/PageHeader';
import { RichText } from '@/components/RichText';
import { UserAvatar } from '@/components/UserAvatar';
import { UserBadges } from '@/components/UserBadges';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useInfiniteList, useViewer } from '@/hooks/use-queries';
import { api, errorMessage, uploadImage } from '@/lib/api';
import { countChars, MAX_CHANNEL_POST_LENGTH, MAX_IMAGES } from '@/lib/text';
import { formatFull, formatRelative } from '@/lib/time';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { Channel, ChannelMember, ChannelPost, User } from '@/types/post';

/** 管理者の操作（キック・解除）。成功したらチャンネル関連のキャッシュを更新する */
function useChannelAdmin(channelId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['channel', channelId] });
    qc.invalidateQueries({ queryKey: ['channel-members', channelId] });
    qc.invalidateQueries({ queryKey: ['channels'] });
  };
  return {
    async kick(user: User) {
      if (!confirm(`@${user.username} をチャンネルからキックしますか？\n解除するまで再参加できなくなります。`)) return;
      try {
        await api(`/api/channels/${channelId}/members/${user.id}`, { method: 'DELETE' });
        toast(`@${user.username} をキックしました`);
        refresh();
      } catch (e) {
        toastError(errorMessage(e));
      }
    },
    async unban(user: User) {
      try {
        await api(`/api/channels/${channelId}/bans/${user.id}`, { method: 'DELETE' });
        toast(`@${user.username} のキックを解除しました`);
        refresh();
      } catch (e) {
        toastError(errorMessage(e));
      }
    },
  };
}

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
  const posts = useInfiniteList<ChannelPost>(['channel-posts', id], `/api/channels/${id}/posts`, { enabled: !!channel, refetchInterval: 10_000 });

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

      {channel.isMember && <ChannelComposer channelId={id} />}

      <InfiniteList
        query={posts}
        render={(p) => <ChannelPostItem post={p} channel={channel} />}
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

function ChannelComposer({ channelId }: { channelId: string }) {
  const me = useViewer();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const len = countChars(content);
  const over = len > MAX_CHANNEL_POST_LENGTH;
  const canSubmit = (content.trim().length > 0 || images.length > 0) && !over && uploading === 0;

  const post = useMutation({
    mutationFn: () => api<{ post: ChannelPost }>(`/api/channels/${channelId}/posts`, { method: 'POST', json: { content, images } }),
    onSuccess: () => {
      setContent('');
      setImages([]);
      qc.invalidateQueries({ queryKey: ['channel-posts', channelId] });
      qc.invalidateQueries({ queryKey: ['channel', channelId] });
      qc.invalidateQueries({ queryKey: ['channels'] });
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  async function addFiles(files: File[]) {
    const room = MAX_IMAGES - images.length - uploading;
    const picked = files.filter((f) => f.type.startsWith('image/')).slice(0, Math.max(room, 0));
    if (files.length > 0 && picked.length === 0) {
      toastError(room <= 0 ? `画像は${MAX_IMAGES}枚までです` : '画像ファイルを選択してください');
      return;
    }
    setUploading((n) => n + picked.length);
    await Promise.all(
      picked.map(async (f) => {
        try {
          const url = await uploadImage(f);
          setImages((prev) => (prev.length < MAX_IMAGES ? [...prev, url] : prev));
        } catch (e) {
          toastError(errorMessage(e));
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  return (
    <div className="p-4 border-b border-border/60 flex gap-3 focus-within:bg-accent/10 transition-colors">
      <UserAvatar user={me} />
      <div className="flex-1 min-w-0 space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              addFiles(files);
            }
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit && !post.isPending) post.mutate();
          }}
          rows={2}
          placeholder="このチャンネルで語ろう"
          aria-label="チャンネルへの投稿"
          className="w-full bg-transparent border-none resize-none focus:outline-none text-base placeholder:text-muted-foreground/70 field-sizing-content min-h-12 max-h-[40vh]"
        />

        {(images.length > 0 || uploading > 0) && (
          <div className="grid grid-cols-2 gap-2">
            {images.map((src) => (
              <div key={src} className="relative rounded-xl overflow-hidden border border-border/50 aspect-video bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((s) => s !== src))}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 text-white hover:bg-black"
                  aria-label="画像を削除"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, i) => (
              <div key={`u${i}`} className="rounded-xl border border-dashed aspect-video bg-muted/50 flex items-center justify-center">
                <div className="size-5 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border/40 pt-2">
          <div className="text-primary">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              hidden
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={images.length + uploading >= MAX_IMAGES}
              className="p-2 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-40"
              aria-label="画像を追加"
            >
              <ImagePlus className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {len > MAX_CHANNEL_POST_LENGTH - 50 && (
              <span className={cn('text-xs', over ? 'text-destructive font-bold' : 'text-muted-foreground')}>{MAX_CHANNEL_POST_LENGTH - len}</span>
            )}
            <Button onClick={() => post.mutate()} disabled={!canSubmit || post.isPending} className="rounded-full px-5 h-9 font-bold">
              {post.isPending ? '送信中...' : '投稿する'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelPostItem({ post, channel }: { post: ChannelPost; channel: Channel }) {
  const qc = useQueryClient();
  const me = useViewer();
  const admin = useChannelAdmin(channel.id);
  const canKick = channel.isOwner && !post.byOwner && post.author.id !== me.id;

  async function remove() {
    if (!confirm('この投稿を削除しますか？')) return;
    try {
      await api(`/api/channels/${channel.id}/posts/${post.id}`, { method: 'DELETE' });
      toast('投稿を削除しました');
      qc.invalidateQueries({ queryKey: ['channel-posts', channel.id] });
      qc.invalidateQueries({ queryKey: ['channel', channel.id] });
    } catch (e) {
      toastError(errorMessage(e));
    }
  }

  return (
    <article className="px-4 pt-3 pb-3 border-b border-border/60 flex gap-3">
      <Link href={`/${post.author.username}`} aria-label={`${post.author.name}のプロフィール`} className="shrink-0">
        <UserAvatar user={post.author} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 text-sm">
            <Link href={`/${post.author.username}`} className="font-bold hover:underline truncate">
              {post.author.name}
            </Link>
            <UserBadges user={post.author} />
            {post.byOwner && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">管理者</span>}
            <span className="text-muted-foreground truncate">@{post.author.username}</span>
            <span className="text-muted-foreground text-xs whitespace-nowrap" title={formatFull(post.createdAt)}>
              ・{formatRelative(post.createdAt)}
            </span>
          </div>
          {(post.canDelete || canKick) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="text-muted-foreground hover:text-foreground p-1.5 -mr-1.5 rounded-full hover:bg-accent transition-colors outline-none"
                aria-label="その他"
              >
                <MoreHorizontal className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {post.canDelete && (
                  <DropdownMenuItem variant="destructive" onClick={remove}>
                    <Trash2 /> 投稿を削除
                  </DropdownMenuItem>
                )}
                {canKick && (
                  <DropdownMenuItem variant="destructive" onClick={() => admin.kick(post.author)}>
                    <UserMinus /> チャンネルからキック
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {post.content && <RichText text={post.content} className="mt-1 text-[15px] sm:text-base leading-relaxed text-foreground/90" />}
        <ImageGrid images={post.images} />
      </div>
    </article>
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
