'use client';

import Link from 'next/link';
import { UserAvatar } from '@/components/UserAvatar';
import { UserBadges } from '@/components/UserBadges';
import { FollowButton } from '@/components/FollowButton';
import { useMe } from '@/hooks/use-queries';
import type { UserSummary } from '@/types/post';

export function UserListItem({ user, compact = false }: { user: UserSummary; compact?: boolean }) {
  const { data: me } = useMe();
  const isMe = me?.username === user.username;
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
      <Link href={`/${user.username}`} className="shrink-0" aria-label={`${user.name}のプロフィール`}>
        <UserAvatar user={user} className="size-11" />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/${user.username}`} className="min-w-0 block">
            <span className="font-bold text-sm flex items-center gap-1 hover:underline truncate">
              <span className="truncate">{user.name}</span>
              <UserBadges user={user} />
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              @{user.username}
              {user.followsYou && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">フォローされています</span>}
            </span>
          </Link>
          {!isMe && <FollowButton username={user.username} isFollowing={user.isFollowing} />}
        </div>
        {!compact && user.bio && <p className="text-sm mt-1 text-foreground/90 line-clamp-2 break-words">{user.bio}</p>}
      </div>
    </div>
  );
}
