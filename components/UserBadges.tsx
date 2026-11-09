import { CustomEmojiImg } from '@/components/CustomEmoji';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { cn } from '@/lib/utils';
import type { User } from '@/types/post';

/** 名前の横に並べるバッジ（認証マーク + ユーザーが選んだカスタム絵文字バッジ） */
export function UserBadges({ user, className }: { user: Pick<User, 'isVerified' | 'badge' | 'isBot'>; className?: string }) {
  return (
    <>
      {user.isVerified && <VerifiedBadge />}
      {user.isBot && (
        <span className="shrink-0 rounded border px-1 text-[10px] font-bold leading-4 text-muted-foreground align-middle" title="ボットアカウント">
          BOT
        </span>
      )}
      {user.badge && <CustomEmojiImg emoji={user.badge} className={cn('size-4 shrink-0 object-contain align-middle mx-0', className)} />}
    </>
  );
}
