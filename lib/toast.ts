import { useSyncExternalStore } from 'react';

export interface ToastItem {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, kind: ToastItem['kind'] = 'info') {
  const id = nextId++;
  items = [...items, { id, message, kind }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 3500);
}

export const toastError = (message: string) => toast(message, 'error');

const EMPTY: ToastItem[] = [];

export function useToasts() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => EMPTY,
  );
}
