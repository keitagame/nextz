import { Suspense } from 'react';
import { Spinner } from '@/components/PageHeader';
import { ProfileView } from './profile-view';

export default function ProfilePage() {
  return (
    <Suspense fallback={<Spinner className="py-20" />}>
      <ProfileView />
    </Suspense>
  );
}
