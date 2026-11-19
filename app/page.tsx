import type { Metadata } from 'next';
import { Timeline } from '@/components/Timeline';

// トップページの OGP 画像。public/ogpz.png に置く（metadataBase により絶対 URL に解決される）
const OGP_IMAGE = '/ogpz.png';

export const metadata: Metadata = {
  title: { absolute: 'ホーム / Z' },
  // openGraph / twitter はレイアウト側の指定と深くマージされないため、ここで全項目を指定する
  openGraph: {
    type: 'website',
    siteName: 'Z',
    locale: 'ja_JP',
    title: 'Z',
    description: 'NextZ、SNSです。',
    url: '/',
    images: [{ url: OGP_IMAGE, alt: 'Z' }],
  },
  // summary_large_image で画像を大きく表示する
  twitter: { card: 'summary_large_image', title: 'Z', description: 'Zの再構築', images: [OGP_IMAGE] },
};

/** ホーム = タイムライン（機能一覧は持たず、全機能は左ナビ / スマホのドロワーから開く） */
export default function HomePage() {
  return <Timeline />;
}
