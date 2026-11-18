'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Trash2 } from 'lucide-react';
import { InfiniteList } from '@/components/InfiniteList';
import { EmptyState, PageHeader } from '@/components/PageHeader';
import { PostCard } from '@/components/PostCard';
import { useInfiniteList, useViewer } from '@/hooks/use-queries';
import { api, errorMessage } from '@/lib/api';
import { toast, toastError } from '@/lib/toast';
import type { FeedItem } from '@/types/post';

export default function BookmarksPage() {
  const me = useViewer();
  const qc = useQueryClient();
  const list = useInfiniteList<FeedItem>(['bookmarks'], '/api/bookmarks');
  const clear = useMutation({
    mutationFn: () => api('/api/bookmarks', { method: 'DELETE' }),
    onSuccess: () => {
      toast('ブックマークをすべて削除しました');
      qc.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onError: (e) => toastError(errorMessage(e)),
  });
  const hasItems = (list.data?.pages[0]?.items.length ?? 0) > 0;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="ブックマーク"
        subtitle={`@${me.username}`}
        right={
          hasItems && (
            <button
              onClick={() => confirm('ブックマークをすべて削除しますか？') && clear.mutate()}
              className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="すべて削除"
              aria-label="すべて削除"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )
        }
      />
      <InfiniteList
        query={list}
        render={(i) => <PostCard post={i.post} />}
        empty={<EmptyState icon={<Bookmark className="w-6 h-6" />} title="ポストを保存しましょう" description="気になるポストをブックマークしておくと、後から簡単に確認できます。" />}
      />
    </div>
  );
}
