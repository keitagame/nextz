'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';

/**
 * メールのリンクを開いただけでは確認しない（メールの自動スキャナーがリンクを先に開いても無効にならないように、
 * ボタンを押した時点で初めて確認する）。トークンは URL の ?token= から読む。
 */
export function VerifyEmailView() {
  // サーバー描画中は undefined（まだ分からない）、ブラウザでは URL の ?token= を読む
  const token = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get('token'),
    () => undefined,
  );

  const verify = useMutation({
    mutationFn: () => api<{ email: string }>('/api/auth/email/verify', { method: 'POST', json: { token } }),
    onSuccess: () => window.history.replaceState(null, '', window.location.pathname), // 使い終わったトークンを URL から消す
  });

  if (token === undefined) return null;

  return (
    <div className="p-6 space-y-4 text-center">
      {verify.isSuccess ? (
        <>
          <p className="font-bold">メールアドレスを確認しました</p>
          <p className="text-sm text-muted-foreground"><span className="break-all">{verify.data.email}</span> が確認済みになりました。</p>
          <Link href="/login" className="inline-block text-primary font-bold hover:underline">ログインへ進む</Link>
        </>
      ) : !token ? (
        <p className="text-sm text-destructive">リンクが正しくありません。確認メールのリンクをもう一度開いてください。</p>
      ) : (
        <>
          <p className="text-sm">下のボタンを押すと、メールアドレスの確認が完了します。</p>
          {verify.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(verify.error)}</p>}
          <Button onClick={() => verify.mutate()} disabled={verify.isPending} className="rounded-full font-bold px-6 h-11">
            {verify.isPending ? '確認中...' : 'メールアドレスを確認する'}
          </Button>
        </>
      )}
    </div>
  );
}
