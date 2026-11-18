import type { Metadata } from 'next';
import { Timeline } from '@/components/Timeline';

export const metadata: Metadata = { title: { absolute: 'ホーム / Z' } };

/** ホーム = タイムライン（機能一覧は持たず、全機能は左ナビ / スマホのドロワーから開く） */
export default function HomePage() {
  return <Timeline />;
}
