'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeveloperSection } from '@/components/DeveloperSettings';
import { BadgeSection, EmojiManager } from '@/components/EmojiSettings';
import { PageHeader } from '@/components/PageHeader';
import { useViewer } from '@/hooks/use-queries';
import { api, errorMessage } from '@/lib/api';
import { setSessionUser } from '@/lib/session';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

type Theme = 'system' | 'light' | 'dark';

function applyTheme(t: Theme) {
  try {
    if (t === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', t);
  } catch {}
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export default function SettingsPage() {
  const me = useViewer();
  const qc = useQueryClient();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem('theme');
      return t === 'dark' || t === 'light' ? t : 'system';
    } catch {
      return 'system';
    }
  });
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  const changePw = useMutation({
    mutationFn: () => api('/api/me/password', { method: 'POST', json: { current, next } }),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      toast('パスワードを変更しました');
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/');
    setSessionUser(qc, null);
  }

  const themes: { id: Theme; label: string; icon: React.ReactNode }[] = [
    { id: 'system', label: '端末の設定', icon: <Monitor className="w-4 h-4" /> },
    { id: 'light', label: 'ライト', icon: <Sun className="w-4 h-4" /> },
    { id: 'dark', label: 'ダーク', icon: <Moon className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader title="設定" subtitle={`@${me.username}`} back />
      <div className="divide-y divide-border/60">
        <section className="p-4 space-y-3">
          <h2 className="font-bold">表示テーマ</h2>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="表示テーマ">
            {themes.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={theme === t.id}
                onClick={() => {
                  setTheme(t.id);
                  applyTheme(t.id);
                }}
                className={cn('flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition-colors', theme === t.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent')}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </section>

        <BadgeSection />
        <EmojiManager />

        <section className="p-4 space-y-3">
          <h2 className="font-bold">パスワードの変更</h2>
          <form
            className="space-y-3 max-w-sm"
            onSubmit={(e) => {
              e.preventDefault();
              changePw.mutate();
            }}
          >
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="現在のパスワード" autoComplete="current-password" aria-label="現在のパスワード" className="h-10" />
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="新しいパスワード（8文字以上）" autoComplete="new-password" minLength={8} aria-label="新しいパスワード" className="h-10" />
            <Button type="submit" disabled={!current || next.length < 8 || changePw.isPending} className="rounded-full font-bold px-5">変更する</Button>
          </form>
        </section>

        <DeveloperSection />

        <section className="p-4 space-y-3">
          <h2 className="font-bold">アカウント</h2>
          <Button variant="destructive" onClick={logout} className="rounded-full font-bold px-5">ログアウト</Button>
        </section>
      </div>
    </div>
  );
}
