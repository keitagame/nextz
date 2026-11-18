'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { DECORATION_SCALE } from '@/lib/decorations';
import type { User } from '@/types/post';

/** アイコン。デコレーション（フレーム画像）はアイコンの中央に DECORATION_SCALE 倍の大きさで重ねる */
export function UserAvatar({ user, className }: { user: Pick<User, 'name' | 'avatarUrl'> & { avatarDecoration?: string | null }; className?: string }) {
  return (
    <Avatar className={cn('size-10', className)}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
      <AvatarFallback className="font-bold">{Array.from(user.name)[0] ?? '?'}</AvatarFallback>
      {user.avatarDecoration && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarDecoration}
          alt=""
          draggable={false}
          style={{ width: `${DECORATION_SCALE * 100}%`, height: `${DECORATION_SCALE * 100}%` }}
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
        />
      )}
    </Avatar>
  );
}
