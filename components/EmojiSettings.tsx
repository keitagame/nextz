'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomEmojiImg } from '@/components/CustomEmoji';
import { EmojiGrid } from '@/components/EmojiGrid';
import { UserAvatar } from '@/components/UserAvatar';
import { UserBadges } from '@/components/UserBadges';
import { useDecorations, useEmojis, useRefreshContent, useViewer } from '@/hooks/use-queries';
import { api, errorMessage, uploadImage } from '@/lib/api';
import { DECORATION_SCALE, MAX_BADGES, MAX_DECORATION_BYTES } from '@/lib/decorations';
import { SHORTCODE_RE } from '@/lib/text';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { AvatarDecoration, CustomEmoji, Profile } from '@/types/post';

const MAX_EMOJI_KB = 512;

/** プロフィール名の横に表示するバッジ（カスタム絵文字・最大 MAX_BADGES 個）を選ぶ */
export function BadgeSection() {
  const me = useViewer();
  const qc = useQueryClient();
  const badges = me.badges ?? [];
  const ids = badges.map((b) => b.id);

  const save = useMutation({
    mutationFn: (emojiIds: string[]) => api<{ user: Profile }>('/api/me', { method: 'PATCH', json: { badgeEmojiIds: emojiIds } }),
    onSuccess: ({ user }) => {
      qc.setQueryData(['me'], user);
      qc.setQueryData(['profile', user.username], user);
      // 表示済みのポスト・一覧のバッジも更新する
      qc.invalidateQueries({ predicate: (q) => !['me', 'profile', 'counters', 'emojis'].includes(String(q.queryKey[0])) });
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  /** 選択済みなら外し、未選択なら末尾に追加する（上限あり） */
  function toggle(emoji: CustomEmoji) {
    if (save.isPending) return;
    if (ids.includes(emoji.id)) return save.mutate(ids.filter((id) => id !== emoji.id));
    if (ids.length >= MAX_BADGES) return toastError(`バッジは${MAX_BADGES}個まで設定できます。外してから選んでください`);
    save.mutate([...ids, emoji.id]);
  }

  return (
    <section className="p-4 space-y-3">
      <div>
        <h2 className="font-bold">
          バッジ <span className="text-xs font-normal text-muted-foreground">{badges.length}/{MAX_BADGES}</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">好きなカスタム絵文字を、名前の横に最大{MAX_BADGES}個まで表示できます。選んだ順に並びます。</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm flex items-center gap-1 px-3 py-1.5 rounded-full border bg-muted/40">
          <span className="font-bold truncate max-w-48">{me.name}</span>
          <UserBadges user={me} />
        </span>
        {badges.length > 0 && (
          <Button variant="outline" size="sm" className="rounded-full" disabled={save.isPending} onClick={() => save.mutate([])}>
            すべて外す
          </Button>
        )}
      </div>

      {badges.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="設定中のバッジ">
          {badges.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate(ids.filter((id) => id !== b.id))}
                className="group flex items-center gap-1 rounded-full border pl-2 pr-1.5 py-1 text-xs hover:border-destructive/50 hover:bg-destructive/10 transition-colors"
                aria-label={`:${b.shortcode}: を外す`}
              >
                <CustomEmojiImg emoji={b} className="size-5 mx-0 align-middle" />
                <code>:{b.shortcode}:</code>
                <X className="w-3 h-3 text-muted-foreground group-hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <EmojiGrid className="max-w-sm" selectedIds={ids} onPick={toggle} />
    </section>
  );
}

/** アイコンデコレーション（フレーム画像）を選ぶ・登録する・自分の登録分を削除する */
export function DecorationSection() {
  const me = useViewer();
  const qc = useQueryClient();
  const { data: items, isPending } = useDecorations();
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const current = items?.find((d) => d.url === me.avatarDecoration) ?? null;

  const select = useMutation({
    mutationFn: (id: string | null) => api<{ user: Profile }>('/api/me', { method: 'PATCH', json: { avatarDecorationId: id } }),
    onSuccess: ({ user }) => {
      qc.setQueryData(['me'], user);
      qc.setQueryData(['profile', user.username], user);
      qc.invalidateQueries({ predicate: (q) => !['me', 'profile', 'counters', 'emojis', 'decorations'].includes(String(q.queryKey[0])) });
      toast(user.avatarDecoration ? 'デコレーションを設定しました' : 'デコレーションを外しました');
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|gif|webp)$/.test(f.type)) return toastError('透過に対応した PNG / GIF / WebP を選択してください');
    if (f.size > MAX_DECORATION_BYTES) return toastError(`画像は${MAX_DECORATION_BYTES / 1024}KB以下にしてください`);
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(f);
  }

  const create = useMutation({
    mutationFn: async () => {
      const image = await uploadImage(file!, { decoration: true });
      return api('/api/decorations', { method: 'POST', json: { name: name.trim(), image } });
    },
    onSuccess: () => {
      toast('デコレーションを追加しました');
      setName('');
      setFile(null);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ['decorations'] });
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  async function remove(d: AvatarDecoration) {
    if (!confirm(`「${d.name}」を削除しますか？\nこのデコレーションを使っている人のアイコンからも外れます。`)) return;
    try {
      await api(`/api/decorations/${d.id}`, { method: 'DELETE' });
      toast('デコレーションを削除しました');
      qc.invalidateQueries({ queryKey: ['decorations'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ predicate: (q) => !['me', 'counters', 'emojis', 'decorations'].includes(String(q.queryKey[0])) });
    } catch (err) {
      toastError(errorMessage(err));
    }
  }

  return (
    <section id="decorations" className="p-4 space-y-4 scroll-mt-16">
      <div>
        <h2 className="font-bold">アイコンデコレーション</h2>
        <p className="text-xs text-muted-foreground mt-0.5">アイコンにフレーム画像を重ねて表示します。誰でも追加でき、削除できるのは登録した本人だけです。</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="p-3">
          <UserAvatar user={me} className="size-16" />
        </div>
        {me.avatarDecoration && (
          <Button variant="outline" size="sm" className="rounded-full" disabled={select.isPending} onClick={() => select.mutate(null)}>
            デコレーションを外す
          </Button>
        )}
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : !items || items.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだ登録されていません。下のフォームから追加できます。</p>
      ) : (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-w-md" role="radiogroup" aria-label="アイコンデコレーション">
          {items.map((d) => (
            <li key={d.id} className="relative">
              <button
                type="button"
                role="radio"
                aria-checked={current?.id === d.id}
                disabled={select.isPending}
                onClick={() => current?.id !== d.id && select.mutate(d.id)}
                className={cn('w-full flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] hover:bg-accent transition-colors', current?.id === d.id && 'border-primary bg-primary/10 font-bold')}
              >
                <UserAvatar user={{ name: me.name, avatarUrl: me.avatarUrl, avatarDecoration: d.url }} className="size-12 my-1.5" />
                <span className="w-full truncate text-center">{d.name}</span>
              </button>
              {d.mine && (
                <button type="button" onClick={() => remove(d)} className="absolute top-0.5 right-0.5 p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label={`「${d.name}」を削除`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="space-y-3 max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (file && name.trim()) create.mutate();
        }}
      >
        <h3 className="text-sm font-bold">デコレーションを追加</h3>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/png,image/gif,image/webp" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="size-16 shrink-0 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors overflow-hidden bg-muted/40"
            aria-label="フレーム画像を選択"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full object-contain" />
            ) : (
              <ImagePlus className="w-5 h-5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="名前（例: 桜のフレーム）" maxLength={30} aria-label="デコレーションの名前" className="h-10" />
            <p className="text-[11px] mt-1 text-muted-foreground">
              正方形の透過画像（PNG・GIF・WebP、{MAX_DECORATION_BYTES / 1024}KB以下）。中央をアイコンの大きさでくり抜き、アイコンが画像の中央約{Math.round(100 / DECORATION_SCALE)}%に収まるように作ってください。
            </p>
          </div>
        </div>
        <Button type="submit" disabled={!file || !name.trim() || create.isPending} className="rounded-full font-bold px-5">
          {create.isPending ? '追加中...' : 'デコレーションを追加'}
        </Button>
      </form>
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
