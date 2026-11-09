import { Suspense } from 'react';
import { Spinner } from '@/components/PageHeader';
import { ChatView } from './chat-view';

export default function ChatPage() {
  return (
    <Suspense fallback={<Spinner className="py-20" />}>
      <ChatView />
    </Suspense>
  );
}
