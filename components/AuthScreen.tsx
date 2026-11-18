'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TermsDialog } from '@/components/TermsDialog';
import { api, ApiError, errorMessage } from '@/lib/api';
import { setSessionUser } from '@/lib/session';
import { TERMS_VERSION } from '@/lib/terms';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types/post';

interface AuthStatus {
  providers: { id: string; name: string }[];
  pending: null | { kind: 'oauth_signup'; providerName: string; suggestedUsername: string; suggestedName: string };
}

type Step =
  | { kind: 'form' }
  | { kind: 'verify-sent'; email: string; sent: boolean }
  | { kind: 'forgot' }
  | { kind: 'oauth-signup'; providerName: string; suggestedUsername: string; suggestedName: string };

function Logo({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="text-center space-y-2">
      <div className="text-5xl font-bold text-primary">ℤ</div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-bold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/** 利用規約への同意。同意は「規約を最後まで読む」ダイアログ経由でしか付けられない。もう一度押すと取り消せる */
function TermsConsent({ agreed, setAgreed }: { agreed: boolean; setAgreed: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={agreed}
        onClick={() => (agreed ? setAgreed(false) : setOpen(true))}
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
      <TermsDialog open={open} onOpenChange={setOpen} onAgree={() => setAgreed(true)} />
    </div>
  );
}

export function AuthScreen() {
  const status = useQuery({
    queryKey: ['auth-status'],
    queryFn: () => api<AuthStatus>('/api/auth/status'),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const [override, setOverride] = useState<Step | null>(null);
  // OAuth から失敗して戻ってきたときのメッセージ（?oauth_error=...）。AuthScreen はブラウザ上でだけ描画される（AppShell が me の取得を待つ）ので、初期値として読める
  const [notice] = useState<string | null>(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('oauth_error')));
  useEffect(() => {
    if (notice) window.history.replaceState(null, '', window.location.pathname); // 1 回だけ表示して URL から消す
  }, [notice]);

  const pending = status.data?.pending;
  const derived: Step | null =
    pending?.kind === 'oauth_signup'
      ? { kind: 'oauth-signup', providerName: pending.providerName, suggestedUsername: pending.suggestedUsername, suggestedName: pending.suggestedName }
      : null;
  const step: Step = override ?? derived ?? { kind: 'form' };
  const providers = status.data?.providers ?? [];

  const backToForm = () => setOverride({ kind: 'form' });
  const cancelPending = async () => {
    await api('/api/auth/cancel', { method: 'POST' }).catch(() => {});
    backToForm();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-screen">
      <div className="w-full max-w-sm space-y-6">
        {step.kind === 'form' && <CredentialsForm providers={providers} notice={notice} onStep={setOverride} />}
        {step.kind === 'verify-sent' && <VerifySent email={step.email} sent={step.sent} onBack={backToForm} />}
        {step.kind === 'forgot' && <ForgotForm onBack={backToForm} />}
        {step.kind === 'oauth-signup' && <OAuthSignupForm {...step} onCancel={cancelPending} />}
      </div>
    </div>
  );
}

function CredentialsForm({ providers, notice, onStep }: { providers: AuthStatus['providers']; notice: string | null; onStep: (s: Step) => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [resent, setResent] = useState(false);

  const signup = mode === 'signup';

  const auth = useMutation({
    mutationFn: () =>
      api<{ user?: Profile; verifyEmail?: boolean; email?: string; sent?: boolean }>(signup ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        json: signup ? { username, name: name || username, email, password, agreeTerms: agreed, termsVersion: TERMS_VERSION } : { username, password },
      }),
    onSuccess: (r) => {
      if (r.verifyEmail) return onStep({ kind: 'verify-sent', email: r.email ?? email, sent: r.sent !== false });
      if (r.user) {
        setSessionUser(qc, r.user);
        router.replace('/'); // ログイン後は必ずホームへ
      }
    },
  });

  const resend = useMutation({
    mutationFn: () => api('/api/auth/email/resend', { method: 'POST', json: { username, password } }),
    onSuccess: () => setResent(true),
  });
  const unverified = auth.error instanceof ApiError && auth.error.code === 'email_unverified';

  return (
    <>
      <Logo title={signup ? 'アカウントを作成' : 'Zにログイン'} sub={signup ? 'いまどうしてる？を共有しましょう' : 'おかえりなさい'} />

      {notice && <p role="alert" className="text-sm text-destructive text-center">{notice}</p>}

      {providers.length > 0 && (
        <div className="space-y-2">
          {providers.map((p) => (
            // 外部サービスの画面へ丸ごと移動するので、<Link> ではなく通常のリンクにする
            <a
              key={p.id}
              href={`/api/auth/oauth/${p.id}/start`}
              className="flex items-center justify-center w-full h-11 rounded-full border font-bold text-sm hover:bg-accent transition-colors"
            >
              {p.name}で{signup ? '登録' : 'ログイン'}
            </a>
          ))}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            または
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setResent(false);
          auth.mutate();
        }}
      >
        <Field id="username" label={signup ? 'ユーザー名' : 'メールアドレス（昔のアカウントはユーザー名）'}>
          <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete={signup ? 'username' : 'email'} autoCapitalize="none" required maxLength={signup ? 15 : 254} placeholder={signup ? '半角英数字とアンダースコア（3〜15文字）' : 'you@example.com'} className="h-10" />
        </Field>
        {signup && (
          <>
            <Field id="name" label="表示名">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="例：山田 太郎" className="h-10" />
            </Field>
            <Field id="email" label="メールアドレス">
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} placeholder="確認メールを送ります" className="h-10" />
            </Field>
          </>
        )}
        <Field id="password" label="パスワード">
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : 1} placeholder={signup ? '8文字以上' : ''} className="h-10" />
        </Field>

        {signup && <TermsConsent agreed={agreed} setAgreed={setAgreed} />}

        {auth.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(auth.error)}</p>}
        {auth.error instanceof ApiError && auth.error.code === 'use_email' && (
          <p className="text-sm text-muted-foreground">登録したメールアドレスを入力して、もう一度ログインしてください。</p>
        )}
        {unverified && (
          <div className="text-sm space-y-1">
            {resent ? (
              <p className="text-muted-foreground">確認メールを再送しました。メールをご確認ください。</p>
            ) : (
              <button type="button" onClick={() => resend.mutate()} disabled={resend.isPending} className="text-primary font-bold hover:underline">
                {resend.isPending ? '送信中...' : '確認メールを再送する'}
              </button>
            )}
            {resend.isError && <p role="alert" className="text-destructive">{errorMessage(resend.error)}</p>}
          </div>
        )}

        {!signup && (
          <p className="text-right text-sm">
            <button type="button" onClick={() => onStep({ kind: 'forgot' })} className="text-primary hover:underline">パスワードをお忘れですか？</button>
          </p>
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
            setResent(false);
          }}
          className="text-primary font-bold hover:underline"
        >
          {signup ? 'ログイン' : '新規登録'}
        </button>
      </p>
      <p className="text-center text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground hover:underline">ログインせずに閲覧する</Link>
      </p>
    </>
  );
}

/** 新規登録のあと：確認メールのリンクを開くまで、ログインはできない */
function VerifySent({ email, sent, onBack }: { email: string; sent: boolean; onBack: () => void }) {
  return (
    <>
      <Logo title="メールを確認してください" />
      <div className="space-y-3 text-sm text-center">
        {sent ? (
          <p><span className="font-bold break-all">{email}</span> に確認メールを送りました。メール内のリンクを開いて確認を完了すると、ログインできるようになります。</p>
        ) : (
          <p className="text-destructive">アカウントは作成しましたが、確認メールを送れませんでした。ログイン画面から「確認メールを再送する」を押してください。</p>
        )}
        <p className="text-muted-foreground">メールが届かない場合は、迷惑メールフォルダもご確認ください。</p>
      </div>
      <Button onClick={onBack} className="w-full rounded-full h-11 font-bold text-base">ログイン画面へ</Button>
    </>
  );
}

/** パスワードを忘れたとき：メールアドレスに再設定リンクを送る（登録の有無にかかわらず同じ表示にする） */
function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const send = useMutation({ mutationFn: () => api('/api/auth/password/forgot', { method: 'POST', json: { email } }) });

  return (
    <>
      <Logo title="パスワードの再設定" sub="登録したメールアドレスに、再設定用のリンクを送ります" />
      {send.isSuccess ? (
        <p className="text-sm text-center">そのアドレスのアカウントがあれば、再設定メールを送りました（1時間有効）。メールのリンクから新しいパスワードを設定してください。届かない場合は、迷惑メールフォルダもご確認ください。</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <Field id="forgot-email" label="メールアドレス">
            <Input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} className="h-10" />
          </Field>
          {send.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(send.error)}</p>}
          <Button type="submit" disabled={send.isPending} className="w-full rounded-full h-11 font-bold text-base">
            {send.isPending ? '送信中...' : '再設定メールを送る'}
          </Button>
        </form>
      )}
      <p className="text-center text-sm">
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground hover:underline">ログインに戻る</button>
      </p>
    </>
  );
}

/** OAuth で初めてログインしたとき：ユーザー名と利用規約への同意を入力してアカウントを作る */
function OAuthSignupForm({ providerName, suggestedUsername, suggestedName, onCancel }: { providerName: string; suggestedUsername: string; suggestedName: string; onCancel: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [username, setUsername] = useState(suggestedUsername);
  const [name, setName] = useState(suggestedName);
  const [agreed, setAgreed] = useState(false);

  const complete = useMutation({
    mutationFn: () => api<{ user: Profile }>('/api/auth/oauth/complete', { method: 'POST', json: { username, name: name || username, agreeTerms: agreed, termsVersion: TERMS_VERSION } }),
    onSuccess: ({ user }) => {
      setSessionUser(qc, user);
      router.replace('/');
    },
  });

  return (
    <>
      <Logo title="アカウントを作成" sub={`${providerName} でのログインを確認しました。ユーザー名を決めてください`} />
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          complete.mutate();
        }}
      >
        <Field id="oauth-username" label="ユーザー名">
          <Input id="oauth-username" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" required maxLength={15} placeholder="半角英数字とアンダースコア（3〜15文字）" className="h-10" />
        </Field>
        <Field id="oauth-name" label="表示名">
          <Input id="oauth-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="h-10" />
        </Field>
        <TermsConsent agreed={agreed} setAgreed={setAgreed} />
        {complete.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(complete.error)}</p>}
        <Button type="submit" disabled={complete.isPending || !agreed} className="w-full rounded-full h-11 font-bold text-base">
          {complete.isPending ? '処理中...' : 'アカウントを作成'}
        </Button>
      </form>
      <p className="text-center text-sm">
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground hover:underline">キャンセル</button>
      </p>
    </>
  );
}
