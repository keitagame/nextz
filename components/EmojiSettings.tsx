'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomEmojiImg } from '@/components/CustomEmoji';
import { EmojiGrid } from '@/components/EmojiGrid';
import { UserBadges } from '@/components/UserBadges';
import { useEmojis, useRefreshContent, useViewer } from '@/hooks/use-queries';
import { api, errorMessage, uploadImage } from '@/lib/api';
import { SHORTCODE_RE } from '@/lib/text';
import { toast, toastError } from '@/lib/toast';
import type { CustomEmoji, Profile } from '@/types/post';

const MAX_EMOJI_KB = 512;

/** プロフィール名の横に表示するバッジ（カスタム絵文字）を選ぶ */
export function BadgeSection() {
  const me = useViewer();
  const qc = useQueryClient();

  const setBadge = useMutation({
    mutationFn: (emojiId: string | null) => api<{ user: Profile }>('/api/me', { method: 'PATCH', json: { badgeEmojiId: emojiId } }),
    onSuccess: ({ user }) => {
      qc.setQueryData(['me'], user);
      qc.setQueryData(['profile', user.username], user);
      // 表示済みのポスト・一覧のバッジも更新する
      qc.invalidateQueries({ predicate: (q) => !['me', 'profile', 'counters', 'emojis'].includes(String(q.queryKey[0])) });
      toast(user.badge ? 'バッジを設定しました' : 'バッジを外しました');
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  return (
    <section className="p-4 space-y-3">
      <div>
        <h2 className="font-bold">バッジ</h2>
        <p className="text-xs text-muted-foreground mt-0.5">好きなカスタム絵文字を、名前の横に表示できます。</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm flex items-center gap-1 px-3 py-1.5 rounded-full border bg-muted/40">
          <span className="font-bold truncate max-w-48">{me.name}</span>
          <UserBadges user={me} />
        </span>
        {me.badge && (
          <Button variant="outline" size="sm" className="rounded-full" disabled={setBadge.isPending} onClick={() => setBadge.mutate(null)}>
            バッジを外す
          </Button>
        )}
      </div>

      <EmojiGrid
        className="max-w-sm"
        selectedIds={me.badge ? [me.badge.id] : []}
        onPick={(e) => !setBadge.isPending && setBadge.mutate(e.id)}
      />
    </section>
  );
}

/** カスタム絵文字の登録と一覧・削除 */
export function EmojiManager() {
  const qc = useQueryClient();
  const refresh = useRefreshContent();
  const { data: emojis, isPending } = useEmojis();
  const [shortcode, setShortcode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const code = shortcode.trim().toLowerCase();
  const codeValid = SHORTCODE_RE.test(code);

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toastError('画像ファイルを選択してください');
    if (f.size > MAX_EMOJI_KB * 1024) return toastError(`画像は${MAX_EMOJI_KB}KB以下にしてください`);
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(f);
  }

  const create = useMutation({
    mutationFn: async () => {
      const image = await uploadImage(file!, { emoji: true });
      return api('/api/emojis', { method: 'POST', json: { shortcode: code, image } });
    },
    onSuccess: () => {
      toast(`:${code}: を追加しました`);
      setShortcode('');
      setFile(null);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ['emojis'] });
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  async function remove(e: CustomEmoji) {
    if (!confirm(`:${e.shortcode}: を削除しますか？\nこの絵文字のリアクションとバッジも削除されます。`)) return;
    try {
      await api(`/api/emojis/${e.id}`, { method: 'DELETE' });
      toast('絵文字を削除しました');
      qc.invalidateQueries({ queryKey: ['emojis'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      refresh();
    } catch (err) {
      toastError(errorMessage(err));
    }
  }

  return (
    <section id="emojis" className="p-4 space-y-4 scroll-mt-16">
      <div>
        <h2 className="font-bold">カスタム絵文字</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          登録した絵文字は、ポストに <code className="bg-muted px-1 rounded">:ショートコード:</code> と書くと表示され、リアクションやバッジにも使えます。
          誰でも追加でき、削除できるのは登録した本人だけです。
        </p>
      </div>

      <form
        className="space-y-3 max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (file && codeValid) create.mutate();
        }}
      >
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="size-14 shrink-0 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors overflow-hidden"
            aria-label="絵文字の画像を選択"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full object-contain" />
            ) : (
              <ImagePlus className="w-5 h-5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <Input
              value={shortcode}
              onChange={(e) => setShortcode(e.target.value)}
              placeholder="ショートコード（例: party_parrot）"
              maxLength={32}
              aria-label="ショートコード"
              className="h-10"
            />
            <p className={`text-[11px] mt-1 ${code && !codeValid ? 'text-destructive' : 'text-muted-foreground'}`}>
              英数字とアンダースコア、2〜32文字 / 画像は{MAX_EMOJI_KB}KB以下（PNG・GIF・WebP・JPEG）
            </p>
          </div>
        </div>
        <Button type="submit" disabled={!file || !codeValid || create.isPending} className="rounded-full font-bold px-5">
          {create.isPending ? '追加中...' : '絵文字を追加'}
        </Button>
      </form>

      <div>
        <h3 className="text-sm font-bold mb-2">登録済み{emojis ? `（${emojis.length}）` : ''}</h3>
        {isPending ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : !emojis || emojis.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ登録されていません。</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {emojis.map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
                <CustomEmojiImg emoji={e} className="size-7 mx-0 align-middle" />
                <code className="text-xs flex-1 truncate">:{e.shortcode}:</code>
                {e.mine && (
                  <button type="button" onClick={() => remove(e)} className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label={`:${e.shortcode}: を削除`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
