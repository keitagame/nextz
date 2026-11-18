'use client';

import { useCallback, useRef } from 'react';

/**
 * インプレッション（ポストが画面に表示された回数）の送信。
 *  - 画面内に半分以上入ったポストを記録し、ページを開いている間は同じポストを二重に数えない
 *  - 送信は数秒ごとにまとめて 1 リクエスト（サーバーの負荷とレート制限のため）
 */
const FLUSH_MS = 3000;
const MAX_BATCH = 50;
const VISIBLE_RATIO = 0.5;

const counted = new Set<string>();
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  while (queue.length > 0) {
    const ids = queue.slice(0, MAX_BATCH);
    queue = queue.slice(MAX_BATCH);
    // 失敗しても表示には影響させない（ページ遷移・タブを閉じる時にも送れるよう keepalive）
    fetch('/api/posts/impressions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {});
  }
}

function record(id: string) {
  if (counted.has(id)) return;
  counted.add(id);
  queue.push(id);
  if (queue.length >= MAX_BATCH) flush();
  else timer ??= setTimeout(flush, FLUSH_MS);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

/** 要素に ref として渡すと、その要素が画面に表示されたときにポストのインプレッションを 1 回記録する */
export function useImpression(postId: string) {
  const observer = useRef<IntersectionObserver | null>(null);
  return useCallback(
    (el: HTMLElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!el || counted.has(postId) || typeof IntersectionObserver === 'undefined') return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            record(postId);
            io.disconnect();
          }
        },
        { threshold: VISIBLE_RATIO },
      );
      io.observe(el);
      observer.current = io;
    },
    [postId],
  );
}
