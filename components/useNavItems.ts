'use client';

import { Bell, Bookmark, Hash, Home, Search, Settings, ShieldAlert, User, type LucideIcon } from 'lucide-react';
import { useCounters, useMe } from '@/hooks/use-queries';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  badge?: number;
  /** スマホの下部ナビに出すか（出さないものはドロワーから開く） */
  inBar?: boolean;
}

/**
 * アプリの全機能への入口。PC の左サイドバー・スマホの下部ナビ・ドロワーはすべてここから作る。
 * ホーム = タイムライン。機能一覧ページは持たず、どの画面からでもここに並ぶ項目で全機能へ移動できる
 */
export function useNavItems(): NavItem[] {
  const { data: me } = useMe();
  const { data: counters } = useCounters();
  const starts = (x: string) => (p: string) => p === x || p.startsWith(`${x}/`);

  const items: NavItem[] = [
    { icon: Home, label: 'ホーム', href: '/', match: (p) => p === '/', inBar: true },
    { icon: Search, label: '話題を探す', href: '/explore', match: starts('/explore'), inBar: true },
    { icon: Hash, label: 'チャンネル', href: '/channels', match: starts('/channels'), inBar: true },
  ];
  if (!me) return items;

  items.push(
    { icon: Bell, label: '通知', href: '/notifications', match: starts('/notifications'), badge: counters?.notifications, inBar: true },
    { icon: Bookmark, label: 'ブックマーク', href: '/bookmarks', match: starts('/bookmarks') },
    { icon: User, label: 'プロフィール', href: `/${me.username}`, match: (p) => p === `/${me.username}` || p.startsWith(`/${me.username}/`) },
    { icon: Settings, label: '設定', href: '/settings', match: starts('/settings') },
  );
  if (me.viewerIsAdmin) items.push({ icon: ShieldAlert, label: '管理', href: '/admin', match: starts('/admin') });
  return items;
}
