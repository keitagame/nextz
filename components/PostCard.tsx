'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Hash, Link2, MoreHorizontal, Repeat2, Trash2, UserMinus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ImageGrid } from '@/components/ImageGrid';
import { PostActions } from '@/components/PostActions';
import { RichText } from '@/components/RichText';
import { UserAvatar } from '@/components/UserAvatar';
import { ReactionBar } from '@/components/ReactionBar';
import { UserBadges } from '@/components/UserBadges';
import { api, errorMessage } from '@/lib/api';
import { useChannelAdmin } from '@/hooks/use-channel-admin';
import { useRefreshContent, useViewer } from '@/hooks/use-queries';
import { toast, toastError } from '@/lib/toast';
import { formatFull, formatRelative } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { Post, User } from '@/types/post';

/** 引用ポストの埋め込み表示 */
export function QuotedPost({ post }: { post: Post }) {
  const router = useRouter();
  if (post.deleted) {
    return <div className="mt-3 rounded-2xl border border-border/60 p-3 text-sm text-muted-foreground">このポストは削除されました</div>;
  }
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/posts/${post.id}`);
      }}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/posts/${post.id}`)}
      className="mt-3 rounded-2xl border border-border/60 p-3 hover:bg-accent/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2 text-sm">
        <UserAvatar user={post.author} className="size-5" />
        <span className="font-bold truncate">{post.author.name}</span>
        <span className="text-muted-foreground truncate">@{post.author.username}</span>
        <span className="text-muted-foreground text-xs">· {formatRelative(post.createdAt)}</span>
      </div>
      {post.content && <RichText text={post.content} plain className="mt-1 text-sm line-clamp-6 text-foreground/90" />}
      {post.images.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.images[0]} alt="" className="mt-2 rounded-xl max-h-52 w-full object-cover" loading="lazy" />
      )}
    </div>
  );
}

export function PostMenu({ post, onDeleted }: { post: Post; onDeleted?: () => void }) {
  const me = useViewer();
  const refresh = useRefreshContent();
  const mine = me.username === post.author.username;
  const admin = useChannelAdmin(post.channel?.id ?? '');
  // チャンネル管理者は、自分以外・管理者以外の投稿者をそのポストからキックできる
  const canKick = !!post.channel?.viewerIsOwner && !post.channel.byOwner && !mine;

  async function remove() {
    if (!confirm('このポストを削除しますか？この操作は取り消せません。')) return;
    try {
      await api(`/api/posts/${post.id}`, { method: 'DELETE' });
      toast('ポストを削除しました');
      refresh();
      onDeleted?.();
    } catch (e) {
      toastError(errorMessage(e));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="text-muted-foreground hover:text-foreground p-1.5 -mr-1.5 rounded-full hover:bg-accent transition-colors outline-none"
        aria-label="その他"
      >
        <MoreHorizontal className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onClick={async () => {
            await navigator.clipboard.writeText(`${location.origin}/posts/${post.id}`).catch(() => {});
            toast('リンクをコピーしました');
          }}
        >
          <Link2 /> リンクをコピー
        </DropdownMenuItem>
        {post.canDelete && (
          <DropdownMenuItem variant="destructive" onClick={remove}>
            <Trash2 /> ポストを削除
          </DropdownMenuItem>
        )}
        {canKick && (
          <DropdownMenuItem variant="destructive" onClick={() => admin.kick(post.author)}>
            <UserMinus /> チャンネルからキック
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PostCard({
  post,
  repostedBy,
  threadLine = false,
  hideChannel = false,
  onDeleted,
}: {
  post: Post;
  repostedBy?: User | null;
  /** スレッド表示で、このポストの下に返信が続くことを示す縦線 */
  threadLine?: boolean;
  /** チャンネルのタイムライン内など、チャンネル名を表示する必要がないとき */
  hideChannel?: boolean;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  // サーバーから新しい値が来たらローカル状態を同期（楽観的更新と両立させる）
  const [prev, setPrev] = useState(post);
  const [p, setP] = useState(post);
  if (post !== prev) {
    setPrev(post);
    setP(post);
  }

  if (p.deleted) {
    return <div className="p-4 text-sm text-muted-foreground border-b border-border/60">このポストは削除されました</div>;
  }

  const go = () => router.push(`/posts/${p.id}`);

  return (
    <article
      className={cn('px-4 pt-3 pb-1 hover:bg-accent/10 transition-colors cursor-pointer', !threadLine && 'border-b border-border/60')}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        // ポータル（メニュー・ダイアログ）内のクリックや、リンク/ボタンのクリックでは遷移しない
        if (!e.currentTarget.contains(target) || target.closest('a,button,[role="menuitem"],[role="link"],input,textarea')) return;
        if (window.getSelection()?.toString()) return;
        go();
      }}
    >
      {repostedBy && (
        <div className="flex items-center gap-2 pl-8 -mt-0.5 mb-1 text-xs font-semibold text-muted-foreground">
          <Repeat2 className="w-3.5 h-3.5" />
          <Link href={`/${repostedBy.username}`} className="hover:underline">
            {repostedBy.name}さんがリポストしました
          </Link>
        </div>
      )}
      <div className="flex gap-3">
        <div className="flex flex-col items-center shrink-0">
          <Link href={`/${p.author.username}`} aria-label={`${p.author.name}のプロフィール`}>
            <UserAvatar user={p.author} className="transition-opacity hover:opacity-90" />
          </Link>
          {threadLine && <div className="w-0.5 flex-1 bg-border mt-1 -mb-1" />}
        </div>

        <div className="flex-1 min-w-0 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 text-sm">
              <Link href={`/${p.author.username}`} className="font-bold hover:underline truncate">
                {p.author.name}
              </Link>
              <UserBadges user={p.author} />
              {p.channel?.byOwner && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">管理者</span>}
              <span className="text-muted-foreground truncate">@{p.author.username}</span>
              <span className="text-muted-foreground text-xs">·</span>
              <Link href={`/posts/${p.id}`} title={formatFull(p.createdAt)} className="text-muted-foreground text-xs hover:underline whitespace-nowrap">
                {formatRelative(p.createdAt)}
              </Link>
            </div>
            <PostMenu post={p} onDeleted={onDeleted} />
          </div>

          {p.channel && !hideChannel && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <Link href={`/channels/${p.channel.id}`} className="inline-flex items-center gap-0.5 text-primary hover:underline">
                <Hash className="w-3 h-3" />
                {p.channel.name}
              </Link>
            </p>
          )}

          {p.replyToUsername && (
            <p className="text-xs text-muted-foreground mt-0.5">
              返信先: <Link href={`/${p.replyToUsername}`} className="text-primary hover:underline">@{p.replyToUsername}</Link>
            </p>
          )}

          {p.content && <RichText text={p.content} className="mt-1 text-[15px] sm:text-base leading-relaxed text-foreground/90" />}
          <ImageGrid images={p.images} />
          {p.quote && <QuotedPost post={p.quote} />}
          <ReactionBar post={p} setPost={setP} className="mt-2" />

          <PostActions post={p} setPost={setP} />
        </div>
      </div>
    </article>
  );
}
