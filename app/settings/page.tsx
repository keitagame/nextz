'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackgroundSection } from '@/components/BackgroundSettings';
import { DeveloperSection } from '@/components/DeveloperSettings';
import { BadgeSection, DecorationSection, EmojiManager } from '@/components/EmojiSettings';
import { PageHeader } from '@/components/PageHeader';
import { PasswordSection, SecuritySection } from '@/components/SecuritySettings';
import { useViewer } from '@/hooks/use-queries';
import { api } from '@/lib/api';
import { setSessionUser } from '@/lib/session';
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

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/');
    setSessionUser(qc, null);
  }

  const isDark = theme === 'dark' || (theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  const setBase = (b: 'light' | 'dark') => {
    setTheme(b);
    applyTheme(b);
  };

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

        <BackgroundSection isDark={isDark} onBase={setBase} />

        <DecorationSection />
        <BadgeSection />
        <EmojiManager />

        <SecuritySection />
        <PasswordSection />

        <DeveloperSection />

        <section className="p-4 space-y-3">
          <h2 className="font-bold">利用規約</h2>
          <p className="text-sm text-muted-foreground">規約に違反すると、管理者によってアカウントが凍結されることがあります。</p>
          <Link href="/terms" className="inline-block text-sm text-primary font-bold hover:underline">利用規約を読む</Link>
        </section>

        <section className="p-4 space-y-3">
          <h2 className="font-bold">アカウント</h2>
          <Button variant="destructive" onClick={logout} className="rounded-full font-bold px-5">ログアウト</Button>
        </section>
      </div>
    </div>
  );
}
