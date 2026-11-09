import { cn } from '@/lib/utils';

/** チャンネルのアイコン。絵文字が未設定なら名前の頭文字を表示する */
export function ChannelIcon({ icon, name, className }: { icon: string; name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('shrink-0 size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold select-none', className)}
    >
      {icon || Array.from(name)[0] || '#'}
    </span>
  );
}
