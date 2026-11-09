'use client';

import type { Dispatch, SetStateAction } from 'react';
import { api, errorMessage } from '@/lib/api';
import { withReaction } from '@/lib/reactions';
import { toastError } from '@/lib/toast';
import { formatCount } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { EmojiRef, Post } from '@/types/post';

/** リアクションの付け外し（楽観的更新 → サーバーの値で同期、失敗したら元に戻す） */
export function usePostReactions(post: Post, setPost: Dispatch<SetStateAction<Post>>) {
  async function toggle(emoji: EmojiRef) {
    const on = !post.reactions.find((r) => r.id === emoji.id)?.reacted;
    setPost((p) => ({ ...p, reactions: withReaction(p.reactions, emoji, on) }));
    try {
      const r = await api<{ post: Post }>(`/api/posts/${post.id}/reactions/${emoji.id}`, { method: on ? 'PUT' : 'DELETE' });
      setPost(r.post);
    } catch (e) {
      setPost((p) => ({ ...p, reactions: withReaction(p.reactions, emoji, !on) }));
      toastError(errorMessage(e));
    }
  }
  return { toggle };
}

/** ポスト本文の下に並ぶリアクションのチップ（押すと自分のリアクションを付け外し） */
export function ReactionBar({ post, setPost, className }: { post: Post; setPost: Dispatch<SetStateAction<Post>>; className?: string }) {
  const { toggle } = usePostReactions(post, setPost);
  if (post.reactions.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {post.reactions.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => toggle(r)}
          title={`:${r.shortcode}:`}
          aria-label={`:${r.shortcode}: ${r.count}件${r.reacted ? '（取り消す）' : ''}`}
          aria-pressed={r.reacted}
          className={cn(
            'flex items-center gap-1.5 h-7 pl-1.5 pr-2 rounded-full border text-xs font-semibold transition-colors',
            r.reacted ? 'bg-primary/10 border-primary/50 text-primary' : 'border-border hover:bg-accent text-muted-foreground',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.url} alt="" draggable={false} className="size-4.5 object-contain" />
          {formatCount(r.count)}
        </button>
      ))}
    </div>
  );
}
