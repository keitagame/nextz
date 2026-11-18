import { Suspense } from 'react';
import { Spinner } from '@/components/PageHeader';
import { ExploreView } from './explore-view';

export const metadata = { title: '話題を検索' };

export default function ExplorePage() {
  // useSearchParams を使うクライアント部分は Suspense で囲む（Cache Components の要件）
  return (
    <Suspense fallback={<Spinner className="py-20" />}>
      <ExploreView />
    </Suspense>
  );
}
