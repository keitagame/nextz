import { Suspense } from 'react';
import { Spinner } from '@/components/PageHeader';
import { FollowsView } from './follows-view';

export default function FollowsPage() {
  return (
    <Suspense fallback={<Spinner className="py-20" />}>
      <FollowsView />
    </Suspense>
  );
}
