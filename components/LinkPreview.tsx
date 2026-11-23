'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { firstUrl } from '@/lib/text';
import { cn } from '@/lib/utils';
import type { LinkPreviewData } from '@/types/post';

/** 本文の最初の URL の OGP をカードで表示する。取得できなければ何も表示しない（本文のリンクはそのまま残る） */
export function LinkPreview({ text, className }: { text: string; className?: string }) {
  const url = useMemo(() => firstUrl(text), [text]);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // 画面の近くに来てから取得する（タイムライン全件分の外部取得を避ける）
  useEffect(() => {
    const el = ref.current;
    if (!el || !url) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [url]);

  const { data } = useQuery({
    queryKey: ['ogp', url],
    queryFn: () => api<{ preview: LinkPreviewData | null }>(`/api/ogp?url=${encodeURIComponent(url!)}`),
    enabled: !!url && visible,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  if (!url) return null;
  const p = data?.preview;

  return (
    <div ref={ref} className={className}>
      {p && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className={cn('mt-3 block overflow-hidden rounded-2xl border border-border/60 transition-colors hover:bg-accent/30')}
        >
          {p.image && !imgFailed && (
            // 外部サイトの画像なので next/image は使わず、Referer も送らない
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="aspect-[1.91/1] w-full bg-muted object-cover"
            />
          )}
          <div className="space-y-0.5 px-3 py-2 text-sm">
            <p className="truncate text-xs text-muted-foreground">{p.siteName || p.domain}</p>
            <p className="line-clamp-2 font-bold text-foreground">{p.title}</p>
            {p.description && <p className="line-clamp-2 text-muted-foreground">{p.description}</p>}
          </div>
        </a>
      )}
    </div>
  );
}
