'use client';

import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { toast, toastError } from '@/lib/toast';
import type { User } from '@/types/post';

/** 管理者の操作（キック・解除）。成功したらチャンネル関連のキャッシュを更新する */
export function useChannelAdmin(channelId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['channel', channelId] });
    qc.invalidateQueries({ queryKey: ['channel-members', channelId] });
    qc.invalidateQueries({ queryKey: ['channels'] });
  };
  return {
    async kick(user: User) {
      if (!confirm(`@${user.username} をチャンネルからキックしますか？\n解除するまで再参加できなくなります。`)) return;
      try {
        await api(`/api/channels/${channelId}/members/${user.id}`, { method: 'DELETE' });
        toast(`@${user.username} をキックしました`);
        refresh();
      } catch (e) {
        toastError(errorMessage(e));
      }
    },
    async unban(user: User) {
      try {
        await api(`/api/channels/${channelId}/bans/${user.id}`, { method: 'DELETE' });
        toast(`@${user.username} のキックを解除しました`);
        refresh();
      } catch (e) {
        toastError(errorMessage(e));
      }
    },
  };
}
