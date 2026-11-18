'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CustomEmojiImg } from '@/components/CustomEmoji';
import { useEmojiMap } from '@/hooks/use-queries';
import { tokenize } from '@/lib/text';
import { cn } from '@/lib/utils';

/** 本文の #タグ / @メンション / URL をリンク化し、:shortcode: をカスタム絵文字画像にして表示（HTML文字列は使わないので XSS の心配なし） */
export function RichText({ text, plain = false, className }: { text: string; plain?: boolean; className?: string }) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const emojis = useEmojiMap();
  return (
    <p className={cn('whitespace-pre-wrap break-words [overflow-wrap:anywhere]', className)}>
      {tokens.map((t, i) => {
        if (t.type === 'text') return <span key={i}>{t.value}</span>;
        if (t.type === 'emoji') {
          // 登録されていない（または削除された）ショートコードは、そのままの文字として表示する
          const e = emojis.get(t.shortcode);
          return e ? <CustomEmojiImg key={i} emoji={e} /> : <span key={i}>{t.value}</span>;
        }
        if (plain) return <span key={i} className="text-primary">{t.value}</span>;
        const cls = 'text-primary hover:underline';
        if (t.type === 'url')
          return (
            <a key={i} href={t.value} target="_blank" rel="noopener noreferrer nofollow ugc" className={cls}>
              {t.value}
            </a>
          );
        if (t.type === 'tag')
          return (
            <Link key={i} href={`/explore?q=${encodeURIComponent(`#${t.tag}`)}`} prefetch={false} className={cls}>
              {t.value}
            </Link>
          );
        return (
          <Link key={i} href={`/${t.username}`} prefetch={false} className={cls}>
            {t.value}
          </Link>
        );
      })}
    </p>
  );
}
