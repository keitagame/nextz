'use client';

import { useMemo } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Counters, CustomEmoji, Page, Profile } from '@/types/post';

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api<{ user: Profile | null }>('/api/me')).user,
    staleTime: Infinity,
  });

/** ログイン中は必ず存在する前提（AppShell が保証） */
export function useViewer(): Profile {
  const { data } = useMe();
  if (!data) throw new Error('useViewer must be used inside an authenticated tree');
  return data;
}

/** 登録済みカスタム絵文字の一覧（本文表示・ピッカー・設定で共有。更新頻度が低いので長めにキャッシュ） */
export function useEmojis() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ['emojis'],
    queryFn: async () => (await api<{ items: CustomEmoji[] }>('/api/emojis')).items,
    enabled: !!me,
    staleTime: 5 * 60_000,
  });
}

/** shortcode（小文字）→ 絵文字 の辞書 */
export function useEmojiMap(): Map<string, CustomEmoji> {
  const { data } = useEmojis();
  return useMemo(() => new Map((data ?? []).map((e) => [e.shortcode, e])), [data]);
}

export function useCounters() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ['counters'],
    queryFn: () => api<Counters>('/api/me/counters'),
    enabled: !!me,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

/** カーソル方式の無限スクロール用クエリ */
export function useInfiniteList<T>(key: unknown[], url: string, opts: { enabled?: boolean; refetchInterval?: number } = {}) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => {
      const u = new URL(url, 'http://local');
      if (pageParam) u.searchParams.set('cursor', pageParam);
      return api<Page<T>>(`${u.pathname}${u.search}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: opts.enabled ?? true,
    refetchInterval: opts.refetchInterval,
  });
}

/** 投稿・削除などコンテンツが変わったときに、タイムライン系キャッシュをまとめて更新する */
export function useRefreshContent() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      predicate: (q) => !['me', 'counters', 'dm-threads', 'dm', 'emojis', 'active-users', 'channels', 'channel', 'channel-posts', 'channel-members'].includes(String(q.queryKey[0])),
    });
}
