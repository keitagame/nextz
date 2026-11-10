'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api, errorMessage } from '@/lib/api';
import { MAX_BAN_REASON_LENGTH } from '@/lib/text';
import { toast, toastError } from '@/lib/toast';

/** 凍結・解除のあとに、管理画面の一覧とプロフィールのキャッシュを更新する */
function useRefreshModeration() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['admin-users'] }), qc.invalidateQueries({ queryKey: ['profile'] })]);
}

/** 凍結を解除する（確認ダイアログつき） */
export function useUnban() {
  const refresh = useRefreshModeration();
  const m = useMutation({
    mutationFn: (username: string) => api(`/api/admin/users/${username}/ban`, { method: 'DELETE' }),
    onSuccess: async (_d, username) => {
      toast(`@${username} の凍結を解除しました`);
      await refresh();
    },
    onError: (e) => toastError(errorMessage(e)),
  });
  return (username: string) => {
    if (window.confirm(`@${username} の凍結を解除しますか？`)) m.mutate(username);
  };
}

/** 管理者がアカウントを凍結するダイアログ。理由は必須で、本人がログインしようとしたときに表示される */
export function BanDialog({ target, onClose }: { target: { username: string; name: string } | null; onClose: () => void }) {
  const refresh = useRefreshModeration();
  const [reason, setReason] = useState('');

  const ban = useMutation({
    mutationFn: (username: string) => api(`/api/admin/users/${username}/ban`, { method: 'POST', json: { reason } }),
    onSuccess: async (_d, username) => {
      toast(`@${username} を凍結しました`);
      setReason('');
      onClose();
      await refresh();
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  const trimmed = reason.trim();
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !ban.isPending && onClose()}>
      <DialogContent>
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>@{target.username} を凍結する</DialogTitle>
              <DialogDescription>
                {target.name} さんはログインできなくなり、すべてのセッションとボットのトークンが無効になります。理由は本人がログインしようとしたときに表示されます。解除すれば元に戻せます。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <label htmlFor="ban-reason" className="text-xs font-bold text-muted-foreground">凍結の理由（必須）</label>
              <Textarea
                id="ban-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={MAX_BAN_REASON_LENGTH}
                placeholder="例：第3条（禁止事項）に違反する投稿を繰り返したため"
              />
              <p className="text-xs text-muted-foreground text-right">{Array.from(reason).length}/{MAX_BAN_REASON_LENGTH}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={ban.isPending}>キャンセル</Button>
              <Button variant="destructive" disabled={!trimmed || ban.isPending} onClick={() => ban.mutate(target.username)}>
                {ban.isPending ? '処理中...' : '凍結する'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
