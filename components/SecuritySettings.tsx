'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface Security {
  email: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  identities: { provider: string; email: string | null; linkedAt: number }[];
  providers: { id: string; name: string }[];
}

export function useSecurity() {
  return useQuery({ queryKey: ['security'], queryFn: () => api<Security>('/api/me/security'), staleTime: 30_000 });
}

const Badge = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <span className={cn('text-xs font-bold rounded-full px-2 py-0.5', ok ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive')}>{children}</span>
);

/** メールアドレス・外部サービスとの連携 */
export function SecuritySection() {
  const { data } = useSecurity();
  const qc = useQueryClient();

  // OAuth の連携から戻ってきたときの結果（?linked=google / ?oauth_error=...）を 1 回だけ表示して URL から消す
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const linked = p.get('linked');
    const err = p.get('oauth_error');
    if (!linked && !err) return;
    if (linked) toast('アカウントを連携しました');
    if (err) toastError(err);
    window.history.replaceState(null, '', window.location.pathname);
    qc.invalidateQueries({ queryKey: ['security'] });
  }, [qc]);

  if (!data) return null;
  return (
    <>
      <EmailSection s={data} />
      <LinkedSection s={data} />
    </>
  );
}

function EmailSection({ s }: { s: Security }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');

  const send = useMutation({
    mutationFn: (body: { email?: string }) => api<{ email: string }>('/api/me/email', { method: 'POST', json: body }),
    onSuccess: (r) => {
      setEmail('');
      toast(`${r.email} に確認メールを送りました`);
      qc.invalidateQueries({ queryKey: ['security'] });
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-bold">メールアドレス</h2>
      {s.email ? (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="break-all">{s.email}</span>
          <Badge ok={s.emailVerified}>{s.emailVerified ? '確認済み' : '未確認'}</Badge>
          {!s.emailVerified && (
            <button type="button" onClick={() => send.mutate({})} disabled={send.isPending} className="text-primary font-bold hover:underline">
              確認メールを再送
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">未登録です。登録すると、以後はこのメールアドレスでログインする形になり（ユーザー名ではログインできなくなります）、パスワードの再設定もできます。</p>
      )}
      <form
        className="flex gap-2 max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate({ email });
        }}
      >
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={s.email ? '新しいメールアドレス' : 'メールアドレス'} autoComplete="email" aria-label="メールアドレス" className="h-10" />
        <Button type="submit" disabled={!email || send.isPending} className="rounded-full font-bold px-5 shrink-0">
          {s.email ? '変更する' : '登録する'}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">確認メールのリンクを開くまで、変更は反映されません。</p>
    </section>
  );
}

function LinkedSection({ s }: { s: Security }) {
  const qc = useQueryClient();
  const unlink = useMutation({
    mutationFn: (provider: string) => api(`/api/me/oauth/${encodeURIComponent(provider)}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('連携を解除しました');
      qc.invalidateQueries({ queryKey: ['security'] });
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  // 設定されていないプロバイダーは出さない。ただし、すでに連携済みのものは解除できるよう一覧に残す
  const names = new Map(s.providers.map((p) => [p.id, p.name]));
  const ids = [...new Set([...s.providers.map((p) => p.id), ...s.identities.map((i) => i.provider)])];
  if (ids.length === 0) return null;

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-bold">連携アカウント</h2>
      <ul className="space-y-2 max-w-sm">
        {ids.map((id) => {
          const linked = s.identities.find((i) => i.provider === id);
          const name = names.get(id) ?? id;
          return (
            <li key={id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="font-bold">{name}</div>
                {linked?.email && <div className="text-xs text-muted-foreground truncate">{linked.email}</div>}
              </div>
              {linked ? (
                <Button variant="outline" size="sm" onClick={() => unlink.mutate(id)} disabled={unlink.isPending} className="rounded-full font-bold px-4">
                  解除
                </Button>
              ) : (
                // 外部サービスの画面へ丸ごと移動するので、通常のリンクにする
                <a href={`/api/auth/oauth/${id}/start?mode=link`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-full font-bold px-4')}>
                  連携する
                </a>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">連携すると、そのサービスのアカウントでもログインできます。</p>
    </section>
  );
}

/** パスワードの変更。OAuth で作ったアカウント（まだパスワードが無い）は「設定」になり、現在のパスワードは不要 */
export function PasswordSection() {
  const { data } = useSecurity();
  const qc = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const hasPassword = data?.hasPassword ?? true;

  const change = useMutation({
    mutationFn: () => api('/api/me/password', { method: 'POST', json: hasPassword ? { current, next } : { next } }),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      toast(hasPassword ? 'パスワードを変更しました' : 'パスワードを設定しました');
      qc.invalidateQueries({ queryKey: ['security'] });
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-bold">{hasPassword ? 'パスワードの変更' : 'パスワードの設定'}</h2>
      <form
        className="space-y-3 max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
      >
        {hasPassword && <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="現在のパスワード" autoComplete="current-password" aria-label="現在のパスワード" className="h-10" />}
        <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="新しいパスワード（8文字以上）" autoComplete="new-password" minLength={8} aria-label="新しいパスワード" className="h-10" />
        <Button type="submit" disabled={(hasPassword && !current) || next.length < 8 || change.isPending} className="rounded-full font-bold px-5">
          {hasPassword ? '変更する' : '設定する'}
        </Button>
      </form>
    </section>
  );
}
