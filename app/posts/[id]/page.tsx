import { Suspense } from 'react';
import { Spinner } from '@/components/PageHeader';
import { PostDetailView } from './post-detail';

export const metadata = { title: 'ポスト' };

export default function PostDetailPage() {
  return (
    <Suspense fallback={<Spinner className="py-20" />}>
      <PostDetailView />
    </Suspense>
  );
}
