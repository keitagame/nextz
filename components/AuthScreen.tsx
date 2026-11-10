'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TermsDialog } from '@/components/TermsDialog';
import { api, errorMessage } from '@/lib/api';
import { setSessionUser } from '@/lib/session';
import { TERMS_VERSION } from '@/lib/terms';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types/post';

export function AuthScreen() {
  const qc = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const auth = useMutation({
    mutationFn: () =>
      api<{ user: Profile }>(mode === 'login' ? '/api/auth/login' : '/api/auth/signup', {
        method: 'POST',
        json: mode === 'login' ? { username, password } : { username, name: name || username, password, agreeTerms: agreed, termsVersion: TERMS_VERSION },
      }),
    onSuccess: ({ user }) => {
      setSessionUser(qc, user);
      router.replace('/'); // ログイン後は必ずホームへ
    },
  });

  const signup = mode === 'signup';

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-screen">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="text-5xl font-bold text-primary">ℤ</div>
          <h1 className="text-2xl font-bold tracking-tight">{signup ? 'アカウントを作成' : 'Zにログイン'}</h1>
          <p className="text-sm text-muted-foreground">{signup ? 'いまどうしてる？を共有しましょう' : 'おかえりなさい'}</p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            auth.mutate();
          }}
        >
          <div className="space-y-1">
            <label htmlFor="username" className="text-xs font-bold text-muted-foreground">ユーザー名</label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required maxLength={15} placeholder="半角英数字とアンダースコア（3〜15文字）" className="h-10" />
          </div>
          {signup && (
            <div className="space-y-1">
              <label htmlFor="name" className="text-xs font-bold text-muted-foreground">表示名</label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="例：山田 太郎" className="h-10" />
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-bold text-muted-foreground">パスワード</label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : 1} placeholder={signup ? '8文字以上' : ''} className="h-10" />
          </div>

          {signup && (
            <div className="rounded-lg border p-3 space-y-2">
              {/* 同意は「規約を最後まで読む」ダイアログ経由でしか付けられない。もう一度押すと同意を取り消せる */}
              <button
                type="button"
                role="checkbox"
                aria-checked={agreed}
                onClick={() => (agreed ? setAgreed(false) : setTermsOpen(true))}
                className="flex items-start gap-2 text-left text-sm w-full"
              >
                <span className={cn('mt-0.5 size-4 shrink-0 rounded border flex items-center justify-center', agreed ? 'bg-primary border-primary text-primary-foreground' : 'border-input')}>
                  {agreed && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span>{agreed ? '利用規約に同意しました' : '利用規約を読んで同意する（タップして内容を確認）'}</span>
              </button>
              <p className="text-xs text-muted-foreground">
                規約に違反すると、管理者によってアカウントが凍結されることがあります。
                <Link href="/terms" target="_blank" className="text-primary hover:underline ml-1">別のページで開く</Link>
              </p>
            </div>
          )}

          {auth.isError && (
            <p role="alert" className="text-sm text-destructive">{errorMessage(auth.error)}</p>
          )}

          <Button type="submit" disabled={auth.isPending || (signup && !agreed)} className="w-full rounded-full h-11 font-bold text-base">
            {auth.isPending ? '処理中...' : signup ? 'アカウントを作成' : 'ログイン'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {signup ? 'すでにアカウントをお持ちですか？' : 'アカウントをお持ちでないですか？'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(signup ? 'login' : 'signup');
              auth.reset();
            }}
            className="text-primary font-bold hover:underline"
          >
            {signup ? 'ログイン' : '新規登録'}
          </button>
        </p>
      </div>

      <TermsDialog open={termsOpen} onOpenChange={setTermsOpen} onAgree={() => setAgreed(true)} />
    </div>
  );
}
