'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { User } from '@/types/post';

export function UserAvatar({ user, className }: { user: Pick<User, 'name' | 'avatarUrl'>; className?: string }) {
  return (
    <Avatar className={cn('size-10', className)}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
      <AvatarFallback className="font-bold">{Array.from(user.name)[0] ?? '?'}</AvatarFallback>
    </Avatar>
  );
}
