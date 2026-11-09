import { CustomEmojiImg } from '@/components/CustomEmoji';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { cn } from '@/lib/utils';
import type { User } from '@/types/post';

/** 名前の横に並べるバッジ（認証マーク + ユーザーが選んだカスタム絵文字バッジ） */
export function UserBadges({ user, className }: { user: Pick<User, 'isVerified' | 'badge'>; className?: string }) {
  return (
    <>
      {user.isVerified && <VerifiedBadge />}
      {user.badge && <CustomEmojiImg emoji={user.badge} className={cn('size-4 shrink-0 object-contain align-middle mx-0', className)} />}
    </>
  );
}
