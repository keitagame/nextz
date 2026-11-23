'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CreatePostForm } from '@/components/CreatePostForm';
import { useRequireLogin } from '@/hooks/use-queries';
import type { Post } from '@/types/post';

interface ComposeOptions {
  quote?: Post;
}

const Ctx = createContext<{ open: (opts?: ComposeOptions) => void }>({ open: () => {} });

export const useCompose = () => useContext(Ctx);

/** どこからでも「投稿 / 引用」ダイアログを開けるようにする */
export function ComposeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: ComposeOptions; key: number } | null>(null);
  const requireLogin = useRequireLogin();
  // ゲストは投稿・引用できないので、ログイン画面へ案内する
  const open = useCallback(
    (opts: ComposeOptions = {}) => {
      if (!requireLogin()) return;
      setState((s) => ({ opts, key: (s?.key ?? 0) + 1 }));
    },
    [requireLogin],
  );
  const value = useMemo(() => ({ open }), [open]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={!!state} onOpenChange={(o) => !o && setState(null)}>
        <DialogContent className="sm:max-w-xl p-0 top-[8%] translate-y-0 sm:top-[12%]" showCloseButton>
          <DialogTitle className="sr-only">{state?.opts.quote ? '引用' : '新規ポスト'}</DialogTitle>
          {state && (
            <CreatePostForm
              key={state.key}
              quote={state.opts.quote}
              autoFocus
              bordered={false}
              onPosted={() => setState(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
