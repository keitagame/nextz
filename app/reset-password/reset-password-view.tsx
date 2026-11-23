'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';

/** トークンは URL の ?token= から読む。使い終わったら URL から消す */
export function ResetPasswordView() {
  const token = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get('token'),
    () => undefined,
  );
  const [password, setPassword] = useState('');

  const reset = useMutation({
    mutationFn: () => api('/api/auth/password/reset', { method: 'POST', json: { token, password } }),
    onSuccess: () => window.history.replaceState(null, '', window.location.pathname),
  });

  if (token === undefined) return null;

  return (
    <div className="p-6 space-y-4 max-w-sm mx-auto">
      {reset.isSuccess ? (
        <div className="text-center space-y-3">
          <p className="font-bold">パスワードを変更しました</p>
          <p className="text-sm text-muted-foreground">セキュリティのため、すべての端末からログアウトしました。新しいパスワードでログインしてください。</p>
          <Link href="/login" className="inline-block text-primary font-bold hover:underline">ログインへ進む</Link>
        </div>
      ) : !token ? (
        <p className="text-sm text-destructive text-center">リンクが正しくありません。再設定メールのリンクをもう一度開いてください。</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            reset.mutate();
          }}
        >
          <label htmlFor="new-password" className="text-xs font-bold text-muted-foreground">新しいパスワード</label>
          <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required placeholder="8文字以上" className="h-10" />
          {reset.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(reset.error)}</p>}
          <Button type="submit" disabled={password.length < 8 || reset.isPending} className="w-full rounded-full h-11 font-bold text-base">
            {reset.isPending ? '変更中...' : 'パスワードを変更する'}
          </Button>
        </form>
      )}
    </div>
  );
}
