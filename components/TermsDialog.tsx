'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TermsContent } from '@/components/TermsContent';

/** 開くたびに「まだ最後まで読んでいない」状態から始めるため、状態は中身のコンポーネントに持たせる（閉じるとアンマウントされる） */
function Body({ onAgree, onClose }: { onAgree: () => void; onClose: () => void }) {
  const [reachedEnd, setReachedEnd] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const check = () => {
    const el = ref.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReachedEnd(true);
  };
  // 画面が大きくてスクロールなしで全文が見える場合は、そのまま同意できるようにする
  useEffect(check, []);

  return (
    <>
      <DialogHeader>
        <DialogTitle>利用規約</DialogTitle>
        <DialogDescription>アカウントを作成する前に、最後までお読みください。</DialogDescription>
      </DialogHeader>

      <div ref={ref} onScroll={check} tabIndex={0} aria-label="利用規約の本文" className="max-h-[55vh] overflow-y-auto rounded-lg border p-3 pr-4">
        <TermsContent />
      </div>

      <DialogFooter className="items-center sm:justify-between">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {reachedEnd ? '内容をご確認いただきありがとうございます。' : '最後までスクロールすると「同意する」を押せます。'}
        </p>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>閉じる</Button>
          <Button type="button" disabled={!reachedEnd} onClick={onAgree}>同意する</Button>
        </div>
      </DialogFooter>
    </>
  );
}

/** サインアップ時に読ませる利用規約ダイアログ。最後までスクロールしないと「同意する」を押せない */
export function TermsDialog({ open, onOpenChange, onAgree }: { open: boolean; onOpenChange: (open: boolean) => void; onAgree: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <Body
          onClose={() => onOpenChange(false)}
          onAgree={() => {
            onAgree();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
