'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function ImageGrid({ images, className }: { images: string[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  const n = images.length;

  return (
    <>
      <div
        className={cn(
          'mt-3 grid gap-0.5 rounded-2xl overflow-hidden border border-border/50 bg-muted/30',
          n === 1 ? 'grid-cols-1' : 'grid-cols-2 aspect-[16/9]',
          className,
        )}
      >
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setOpen(i)}
            className={cn('relative overflow-hidden block focus-visible:outline-2 outline-primary', n === 3 && i === 0 && 'row-span-2')}
            aria-label={`画像${i + 1}を拡大`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              loading="lazy"
              className={cn('w-full h-full object-cover', n === 1 ? 'max-h-[460px]' : 'absolute inset-0')}
            />
          </button>
        ))}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-4xl p-2 bg-black/90 border-0">
          <DialogTitle className="sr-only">画像プレビュー</DialogTitle>
          {open !== null && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[open]} alt="" className="max-h-[85vh] w-full object-contain rounded-lg" />
          )}
          {open !== null && n > 1 && (
            <div className="flex justify-center gap-2 pb-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setOpen(i)}
                  className={cn('size-2 rounded-full', i === open ? 'bg-white' : 'bg-white/40')}
                  aria-label={`${i + 1}枚目`}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
