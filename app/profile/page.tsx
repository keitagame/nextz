'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/PageHeader';
import { useViewer } from '@/hooks/use-queries';

/** /profile は自分のプロフィールへ転送 */
export default function MyProfileRedirect() {
  const me = useViewer();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/${me.username}`);
  }, [me.username, router]);
  return <Spinner className="py-20" />;
}
