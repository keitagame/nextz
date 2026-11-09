'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ImagePlus, Smile, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmojiGrid } from '@/components/EmojiGrid';
import { UserAvatar } from '@/components/UserAvatar';
import { RichText } from '@/components/RichText';
import { api, errorMessage, uploadImage } from '@/lib/api';
import { useRefreshContent, useViewer } from '@/hooks/use-queries';
import { toast, toastError } from '@/lib/toast';
import { countChars, MAX_CHANNEL_POST_LENGTH, MAX_IMAGES, MAX_POST_LENGTH } from '@/lib/text';
import { cn } from '@/lib/utils';
import type { Post } from '@/types/post';

const EMOJIS = ['😀', '😂', '🥹', '😍', '🥰', '😎', '🤔', '😭', '😡', '🙏', '👍', '👏', '🎉', '🔥', '✨', '💡', '❤️', '💪', '🚀', '🌸', '☕', '🍣', '🎮', '📚'];

interface Props {
  parent?: Post | null;
  quote?: Post | null;
  /** チャンネルに投稿するときのチャンネル ID（返信・引用は元のポストのチャンネルが自動で使われる） */
  channelId?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
  submitLabel?: string;
  bordered?: boolean;
  onPosted?: (post: Post) => void;
}

export function CreatePostForm({ parent, quote, channelId: channelIdProp, placeholder, autoFocus, submitLabel, bordered = true, onPosted }: Props) {
  const me = useViewer();
  const refresh = useRefreshContent();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // チャンネル内（投稿・返信・引用）は 500 文字、グローバルは 280 文字まで
  const channelId = parent ? (parent.channel?.id ?? null) : (channelIdProp ?? quote?.channel?.id ?? null);
  const max = channelId ? MAX_CHANNEL_POST_LENGTH : MAX_POST_LENGTH;

  const len = countChars(content);
  const over = len > max;
  const progress = Math.min((len / max) * 100, 100);
  const canSubmit = (content.trim().length > 0 || images.length > 0) && !over && uploading === 0;

  const post = useMutation({
    mutationFn: () =>
      api<{ post: Post }>('/api/posts', {
        method: 'POST',
        json: { content, images, parentId: parent?.id, quoteOf: quote?.id, channelId },
      }),
    onSuccess: ({ post }) => {
      setContent('');
      setImages([]);
      setShowEmoji(false);
      toast(parent ? '返信しました' : 'ポストしました');
      refresh();
      onPosted?.(post);
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  async function addFiles(files: File[]) {
    const room = MAX_IMAGES - images.length - uploading;
    const picked = files.filter((f) => f.type.startsWith('image/')).slice(0, Math.max(room, 0));
    if (files.length > 0 && picked.length === 0) {
      toastError(room <= 0 ? `画像は${MAX_IMAGES}枚までです` : '画像ファイルを選択してください');
      return;
    }
    setUploading((n) => n + picked.length);
    await Promise.all(
      picked.map(async (f) => {
        try {
          const url = await uploadImage(f);
          setImages((prev) => (prev.length < MAX_IMAGES ? [...prev, url] : prev));
        } catch (e) {
          toastError(errorMessage(e));
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    setContent(content.slice(0, start) + emoji + content.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  /** カスタム絵文字は :shortcode: を挿入する。直前が英数字だと絵文字として認識されないため、その場合は空白を挟む */
  function insertCustomEmoji(shortcode: string) {
    const start = textareaRef.current?.selectionStart ?? content.length;
    const prefix = /[A-Za-z0-9_]$/.test(content.slice(0, start)) ? ' ' : '';
    insertEmoji(`${prefix}:${shortcode}:`);
  }

  return (
    <div className={cn('p-4 transition-colors focus-within:bg-accent/10', bordered && 'border-b border-border/60')}>
      <div className="flex gap-3">
        <UserAvatar user={me} />
        <div className="flex-1 min-w-0 space-y-3">
          {parent && (
            <p className="text-sm text-muted-foreground">
              <span className="text-primary">@{parent.author.username}</span> さんに返信
            </p>
          )}
          <textarea
            ref={textareaRef}
            value={content}
            autoFocus={autoFocus}
            onChange={(e) => setContent(e.target.value)}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length) {
                e.preventDefault();
                addFiles(files);
              }
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit && !post.isPending) post.mutate();
            }}
            placeholder={placeholder ?? (parent ? '返信をポスト' : channelId ? 'このチャンネルで語ろう' : 'いまどうしてる？')}
            rows={2}
            aria-label="ポストの内容"
            className="w-full bg-transparent border-none resize-none focus:outline-none text-base sm:text-lg placeholder:text-muted-foreground/70 field-sizing-content min-h-16 max-h-[50vh]"
          />

          {(images.length > 0 || uploading > 0) && (
            <div className="grid grid-cols-2 gap-2">
              {images.map((src) => (
                <div key={src} className="relative rounded-xl overflow-hidden border border-border/50 aspect-video bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((s) => s !== src))}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 text-white hover:bg-black"
                    aria-label="画像を削除"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {Array.from({ length: uploading }).map((_, i) => (
                <div key={`u${i}`} className="rounded-xl border border-dashed aspect-video bg-muted/50 flex items-center justify-center">
                  <div className="size-5 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
                </div>
              ))}
            </div>
          )}

          {quote && (
            <div className="rounded-2xl border border-border/60 p-3 text-sm">
              <p className="font-bold">
                {quote.author.name} <span className="font-normal text-muted-foreground">@{quote.author.username}</span>
              </p>
              <RichText text={quote.content} plain className="line-clamp-3 text-foreground/90" />
            </div>
          )}

          {showEmoji && (
            <div className="p-2 rounded-xl border bg-popover max-w-xs space-y-2">
              <div className="flex flex-wrap gap-1">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => insertEmoji(e)} className="size-8 text-xl rounded hover:bg-accent" aria-label={e}>
                    {e}
                  </button>
                ))}
              </div>
              <div className="border-t pt-2">
                <p className="text-[11px] font-bold text-muted-foreground mb-1.5">カスタム絵文字</p>
                <EmojiGrid onPick={(e) => insertCustomEmoji(e.shortcode)} maxHeightClass="max-h-40" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/40 pt-3">
            <div className="flex items-center gap-1 text-primary">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={images.length + uploading >= MAX_IMAGES}
                className="p-2 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-40"
                title="画像を追加"
                aria-label="画像を追加"
              >
                <ImagePlus className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                className="p-2 rounded-full hover:bg-primary/10 transition-colors"
                title="絵文字"
                aria-label="絵文字"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {len > 0 && (
                <div className="flex items-center gap-2">
                  {len > max - 20 && (
                    <span className={cn('text-xs', over ? 'text-destructive font-bold' : 'text-muted-foreground')}>{max - len}</span>
                  )}
                  <div className="w-5 h-5 relative flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
                      <path className="text-muted-foreground/25" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path
                        className={over ? 'text-destructive' : 'text-primary'}
                        strokeDasharray={`${progress}, 100`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                  </div>
                </div>
              )}
              <Button
                onClick={() => post.mutate()}
                disabled={!canSubmit || post.isPending}
                className="rounded-full px-5 h-9 font-bold shadow-sm active:scale-95 transition-all"
              >
                {post.isPending ? '送信中...' : (submitLabel ?? (parent ? '返信する' : 'ポストする'))}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
