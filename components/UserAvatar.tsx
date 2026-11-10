'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { isDecorationId } from '@/lib/decorations';
import type { User } from '@/types/post';

/** アイコン。デコレーションは data-decoration 属性で付け、見た目は globals.css（[data-decoration]）が描く */
export function UserAvatar({ user, className }: { user: Pick<User, 'name' | 'avatarUrl'> & { avatarDecoration?: string | null }; className?: string }) {
  return (
    <Avatar className={cn('size-10', className)} data-decoration={isDecorationId(user.avatarDecoration) ? user.avatarDecoration : undefined}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
      <AvatarFallback className="font-bold">{Array.from(user.name)[0] ?? '?'}</AvatarFallback>
    </Avatar>
  );
}
