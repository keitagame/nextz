'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useEmojis } from '@/hooks/use-queries';
import { cn } from '@/lib/utils';
import type { CustomEmoji } from '@/types/post';

/** カスタム絵文字の選択グリッド（検索つき）。リアクション・投稿・バッジ選択で共用 */
export function EmojiGrid({
  onPick,
  selectedIds,
  className,
  maxHeightClass = 'max-h-56',
}: {
  onPick: (emoji: CustomEmoji) => void;
  /** ハイライトする絵文字（リアクション済み・選択中のバッジなど） */
  selectedIds?: string[];
  className?: string;
  maxHeightClass?: string;
}) {
  const { data, isPending, isError } = useEmojis();
  const [q, setQ] = useState('');
  const needle = q.trim().replace(/^:|:$/g, '').toLowerCase();
  const items = (data ?? []).filter((e) => !needle || e.shortcode.includes(needle));

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ショートコードで検索"
          aria-label="絵文字を検索"
          className="w-full h-8 pl-8 pr-2 text-sm rounded-md border border-input bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      {isPending ? (
        <p className="py-6 text-center text-xs text-muted-foreground">読み込み中...</p>
      ) : isError ? (
        <p className="py-6 text-center text-xs text-destructive">絵文字を読み込めませんでした</p>
      ) : (data ?? []).length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          カスタム絵文字がまだありません。
          <br />
          <Link href="/settings#emojis" className="text-primary hover:underline">
            設定から追加する
          </Link>
        </p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">見つかりませんでした</p>
      ) : (
        <div className={cn('grid grid-cols-7 gap-0.5 overflow-y-auto', maxHeightClass)}>
          {items.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onPick(e)}
              title={`:${e.shortcode}:`}
              aria-label={`:${e.shortcode}:`}
              aria-pressed={selectedIds?.includes(e.id)}
              className={cn('size-9 rounded-md flex items-center justify-center hover:bg-accent transition-colors', selectedIds?.includes(e.id) && 'bg-primary/15 ring-1 ring-primary/40')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.url} alt="" loading="lazy" draggable={false} className="size-7 object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
