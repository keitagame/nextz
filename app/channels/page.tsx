import { Suspense } from 'react';
import { Spinner } from '@/components/PageHeader';
import { ChannelsView } from './channels-view';

export const metadata = { title: 'チャンネル' };

export default function ChannelsPage() {
  return (
    <Suspense fallback={<Spinner className="py-20" />}>
      <ChannelsView />
    </Suspense>
  );
}
