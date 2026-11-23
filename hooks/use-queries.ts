'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { AvatarDecoration, Counters, CustomEmoji, Page, Profile } from '@/types/post';

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api<{ user: Profile | null }>('/api/me')).user,
    staleTime: Infinity,
  });

/**
 * ログインが必要な操作の入口で呼ぶ。ログイン済みなら true。
 * ゲスト（未ログイン）なら案内を出してログイン画面へ移動し、false を返す。
 */
export function useRequireLogin(): () => boolean {
  const { data: me } = useMe();
  const router = useRouter();
  return useCallback(() => {
    if (me) return true;
    toast('ログインが必要です');
    router.push('/login');
    return false;
  }, [me, router]);
}

/** ログイン中は必ず存在する前提。ログイン必須ページ（AppShell が未ログインを弾く）でだけ使う */
export function useViewer(): Profile {
  const { data } = useMe();
  if (!data) throw new Error('useViewer must be used inside an authenticated tree');
  return data;
}

/** 登録済みカスタム絵文字の一覧（本文表示・ピッカー・設定で共有。更新頻度が低いので長めにキャッシュ） */
export function useEmojis() {
  return useQuery({
    queryKey: ['emojis'],
    queryFn: async () => (await api<{ items: CustomEmoji[] }>('/api/emojis')).items,
    staleTime: 5 * 60_000,
  });
}

/** 登録済みアイコンデコレーションの一覧（設定画面用） */
export function useDecorations() {
  const { data: me } = useMe();
  return useQuery({
    queryKey: ['decorations'],
    queryFn: async () => (await api<{ items: AvatarDecoration[] }>('/api/decorations')).items,
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

/** 投稿・削除などコンテンツが変わったときに、タイムライン系キャッシュ（チャンネルのタイムライン・投稿数も含む）をまとめて更新する */
export function useRefreshContent() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      predicate: (q) => !['me', 'counters', 'emojis', 'decorations', 'active-users', 'channel-members'].includes(String(q.queryKey[0])),
    });
}
