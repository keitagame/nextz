import { cn } from '@/lib/utils';
import type { EmojiRef } from '@/types/post';

/** カスタム絵文字の画像。文章中ではフォントサイズに合わせて表示される */
export function CustomEmojiImg({ emoji, className }: { emoji: Pick<EmojiRef, 'shortcode' | 'url'>; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={emoji.url}
      alt={`:${emoji.shortcode}:`}
      title={`:${emoji.shortcode}:`}
      draggable={false}
      loading="lazy"
      className={cn('inline-block h-[1.4em] w-auto max-w-[4em] object-contain align-[-0.3em] mx-px', className)}
    />
  );
}
