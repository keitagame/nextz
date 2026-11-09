'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';
import { toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types/post';

export function FollowButton({
  username,
  isFollowing,
  className,
  onChange,
}: {
  username: string;
  isFollowing: boolean;
  className?: string;
  onChange?: (profile: Profile) => void;
}) {
  const qc = useQueryClient();
  const [prevProp, setPrevProp] = useState(isFollowing);
  const [following, setFollowing] = useState(isFollowing);
  const [busy, setBusy] = useState(false);
  if (prevProp !== isFollowing) {
    setPrevProp(isFollowing);
    setFollowing(isFollowing);
  }

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      const r = await api<{ user: Profile }>(`/api/users/${username}/follow`, { method: next ? 'POST' : 'DELETE' });
      setFollowing(r.user.isFollowing);
      onChange?.(r.user);
      qc.setQueryData(['profile', username], r.user);
      qc.invalidateQueries({ queryKey: ['suggestions'] });
      qc.invalidateQueries({ queryKey: ['follows'] });
      qc.invalidateQueries({ queryKey: ['feed', 'following'] });
    } catch (err) {
      setFollowing(!next);
      toastError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      onClick={toggle}
      variant={following ? 'outline' : 'default'}
      className={cn(
        'rounded-full font-bold px-4 h-8 group/follow',
        following && 'hover:border-destructive/40 hover:text-destructive hover:bg-destructive/10',
        className,
      )}
    >
      {following ? (
        <>
          <span className="group-hover/follow:hidden">フォロー中</span>
          <span className="hidden group-hover/follow:inline">解除</span>
        </>
      ) : (
        'フォロー'
      )}
    </Button>
  );
}
