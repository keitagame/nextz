import { Suspense } from 'react';
import { Spinner } from '@/components/PageHeader';
import { ChannelView } from './channel-view';

export const metadata = { title: 'チャンネル' };

export default function ChannelPage() {
  return (
    <Suspense fallback={<Spinner className="py-20" />}>
      <ChannelView />
    </Suspense>
  );
}
