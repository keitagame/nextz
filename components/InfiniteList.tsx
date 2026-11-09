'use client';

import { useEffect, useRef } from 'react';
import type { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import type { Page } from '@/types/post';
import { EmptyState, Spinner } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';

/** 無限スクロールのリスト。末尾が見えたら次ページを自動取得する。 */
export function InfiniteList<T extends { id: string }>({
  query,
  render,
  empty,
  className,
}: {
  query: UseInfiniteQueryResult<InfiniteData<Page<T>>, Error>;
  render: (item: T) => React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
}) {
  const { data, isPending, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) return <Spinner />;
  if (isError)
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button variant="outline" onClick={() => refetch()}>再読み込み</Button>
      </div>
    );

  const items = data.pages.flatMap((p) => p.items);
  if (items.length === 0) return <>{empty ?? <EmptyState title="まだ何もありません" />}</>;

  return (
    <div className={className}>
      {items.map((item) => (
        <div key={item.id}>{render(item)}</div>
      ))}
      <div ref={sentinel} />
      {isFetchingNextPage && <Spinner className="py-4" />}
      {hasNextPage && !isFetchingNextPage && (
        <div className="p-4 text-center">
          <Button variant="ghost" onClick={() => fetchNextPage()}>さらに読み込む</Button>
        </div>
      )}
    </div>
  );
}
