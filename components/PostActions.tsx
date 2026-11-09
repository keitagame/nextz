'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, Heart, MessageCircle, Quote, Repeat2, Share, SmilePlus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmojiGrid } from '@/components/EmojiGrid';
import { usePostReactions } from '@/components/ReactionBar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCompose } from '@/components/ComposeProvider';
import { api, errorMessage } from '@/lib/api';
import { toast, toastError } from '@/lib/toast';
import { formatCount } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { Post } from '@/types/post';

type Kind = 'like' | 'repost' | 'bookmark';

export function PostActions({
  post,
  setPost,
  variant = 'card',
}: {
  post: Post;
  setPost: Dispatch<SetStateAction<Post>>;
  variant?: 'card' | 'detail';
}) {
  const qc = useQueryClient();
  const { open } = useCompose();
  const detail = variant === 'detail';
  const { toggle: toggleReaction } = usePostReactions(post, setPost);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function toggle(kind: Kind) {
    const flag = kind === 'like' ? 'isLiked' : kind === 'repost' ? 'isReposted' : 'isBookmarked';
    const on = !post[flag];
    const delta = on ? 1 : -1;
    // 楽観的更新：押した瞬間に反映し、失敗したら元に戻す
    setPost((p) => ({
      ...p,
      [flag]: on,
      ...(kind === 'like' && { likesCount: p.likesCount + delta }),
      ...(kind === 'repost' && { repostsCount: p.repostsCount + delta }),
      ...(kind === 'bookmark' && { bookmarksCount: p.bookmarksCount + delta }),
    }));
    try {
      const r = await api<{ post: Post }>(`/api/posts/${post.id}/${kind}`, { method: on ? 'POST' : 'DELETE' });
      setPost(r.post);
      if (kind === 'bookmark') qc.invalidateQueries({ queryKey: ['bookmarks'] });
      if (kind === 'repost') {
        qc.invalidateQueries({ queryKey: ['feed'] });
        qc.invalidateQueries({ queryKey: ['channel-posts'] });
      }
    } catch (e) {
      setPost((p) => ({
        ...p,
        [flag]: !on,
        ...(kind === 'like' && { likesCount: p.likesCount - delta }),
        ...(kind === 'repost' && { repostsCount: p.repostsCount - delta }),
        ...(kind === 'bookmark' && { bookmarksCount: p.bookmarksCount - delta }),
      }));
      toastError(errorMessage(e));
    }
  }

  async function share() {
    const url = `${location.origin}/posts/${post.id}`;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ url });
      else {
        await navigator.clipboard.writeText(url);
        toast('リンクをコピーしました');
      }
    } catch {
      /* ユーザーが共有をキャンセルした場合など */
    }
  }

  const btn = 'flex items-center gap-1.5 text-xs transition-colors group/btn';
  const icon = cn('rounded-full', detail ? 'p-2.5' : 'p-2');
  const size = detail ? 'w-5 h-5' : 'w-4 h-4';
  const count = (n: number) => (!detail && n > 0 ? <span>{formatCount(n)}</span> : null);

  return (
    <div className={cn('flex items-center text-muted-foreground', detail ? 'justify-around' : 'justify-between mt-2 max-w-md -ml-2')}>
      <button onClick={() => open({ parent: post })} className={cn(btn, 'hover:text-primary')} aria-label="返信">
        <div className={cn(icon, 'group-hover/btn:bg-primary/10')}>
          <MessageCircle className={size} />
        </div>
        {count(post.repliesCount)}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(btn, post.isReposted ? 'text-emerald-500 font-semibold' : 'hover:text-emerald-500', 'outline-none')}
          aria-label="リポスト"
        >
          <div className={cn(icon, 'group-hover/btn:bg-emerald-500/10')}>
            <Repeat2 className={size} />
          </div>
          {count(post.repostsCount + post.quotesCount)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => toggle('repost')}>
            <Repeat2 /> {post.isReposted ? 'リポストを取り消す' : 'リポスト'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => open({ quote: post })}>
            <Quote /> 引用
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={() => toggle('like')}
        className={cn(btn, post.isLiked ? 'text-rose-500 font-semibold' : 'hover:text-rose-500')}
        aria-label={post.isLiked ? 'いいねを取り消す' : 'いいね'}
        aria-pressed={post.isLiked}
      >
        <div className={cn(icon, 'group-hover/btn:bg-rose-500/10')}>
          <Heart className={cn(size, 'transition-transform', post.isLiked ? 'fill-rose-500 scale-110' : 'group-active/btn:scale-125')} />
        </div>
        {count(post.likesCount)}
      </button>

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger
          className={cn(btn, pickerOpen ? 'text-amber-500' : 'hover:text-amber-500', 'outline-none')}
          aria-label="リアクションを追加"
        >
          <div className={cn(icon, 'group-hover/btn:bg-amber-500/10')}>
            <SmilePlus className={size} />
          </div>
        </PopoverTrigger>
        <PopoverContent align="center">
          <EmojiGrid
            selectedIds={post.reactions.filter((r) => r.reacted).map((r) => r.id)}
            onPick={(e) => {
              setPickerOpen(false);
              toggleReaction(e);
            }}
          />
        </PopoverContent>
      </Popover>

      <button
        onClick={() => toggle('bookmark')}
        className={cn(btn, post.isBookmarked ? 'text-primary' : 'hover:text-primary')}
        aria-label={post.isBookmarked ? 'ブックマークを外す' : 'ブックマーク'}
        aria-pressed={post.isBookmarked}
      >
        <div className={cn(icon, 'group-hover/btn:bg-primary/10')}>
          <Bookmark className={cn(size, post.isBookmarked && 'fill-primary')} />
        </div>
      </button>

      <button onClick={share} className={cn(btn, 'hover:text-foreground')} aria-label="共有">
        <div className={cn(icon, 'group-hover/btn:bg-accent')}>
          <Share className={size} />
        </div>
      </button>
    </div>
  );
}
