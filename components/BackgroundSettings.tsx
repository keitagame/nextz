'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Moon, Sun, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearBackground, getStoredBackground, shrinkForBackground, saveBackground } from '@/lib/background';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

type Base = 'light' | 'dark';

/** 設定：SNS の背景画像（ぼかして表示）とベーステーマ（ダーク / ライト） */
export function BackgroundSection({ isDark, onBase }: { isDark: boolean; onBase: (b: Base) => void }) {
  const [image, setImage] = useState<string | null>(() => getStoredBackground());
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const base: Base = isDark ? 'dark' : 'light';

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const data = await shrinkForBackground(file);
      saveBackground(data);
      setImage(data);
      toast('背景画像を設定しました');
    } catch (e) {
      toastError(e instanceof Error ? e.message : '背景画像を設定できませんでした');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function remove() {
    clearBackground();
    setImage(null);
    toast('背景画像を削除しました');
  }

  const bases: { id: Base; label: string; icon: React.ReactNode }[] = [
    { id: 'dark', label: 'ダーク', icon: <Moon className="w-4 h-4" /> },
    { id: 'light', label: 'ライト', icon: <Sun className="w-4 h-4" /> },
  ];

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-bold">背景画像</h2>
      <p className="text-sm text-muted-foreground">
        好きな画像を背景にできます。画像はこの端末の中で小さく縮小され、強くぼかして表示されます。元の画像は保存もアップロードもされません。設定はこの端末にだけ保存されます。
      </p>

      <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="ベーステーマ">
        {bases.map((b) => (
          <button
            key={b.id}
            role="radio"
            aria-checked={base === b.id}
            onClick={() => onBase(b.id)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition-colors', base === b.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent')}
          >
            {b.icon} {b.label}
          </button>
        ))}
        <span className="self-center text-xs text-muted-foreground">ベーステーマ</span>
      </div>

      {image && (
        <div className="relative h-40 rounded-xl border overflow-hidden" aria-label="背景画像のプレビュー" role="img">
          <div className="absolute -inset-8" style={{ backgroundImage: `url("${image}")`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(16px)' }} />
          {/* 実際の画面と同じく、すべての面が同じ透け具合（不透明度 60%）で重なる */}
          <div className={cn('absolute inset-0', isDark ? 'bg-black/60' : 'bg-white/60')} />
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-2/3 border-x border-border">
            <p className="p-3 text-sm font-bold">プレビュー</p>
            <p className="px-3 text-xs text-muted-foreground">サイドバーもタイムラインも同じ透け具合です</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-full font-bold px-5">
          <ImagePlus className="w-4 h-4" /> {image ? '画像を変更' : '画像を選ぶ'}
        </Button>
        {image && (
          <Button variant="outline" onClick={remove} className="rounded-full font-bold px-5">
            <Trash2 className="w-4 h-4" /> 削除
          </Button>
        )}
      </div>
    </section>
  );
}
