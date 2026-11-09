import type { QueryClient } from '@tanstack/react-query';
import type { Profile } from '@/types/post';

/**
 * ログイン / ログアウト時にキャッシュを入れ替える。
 * 注意: qc.clear() は購読中の ['me'] クエリごと消してしまい、画面に新しい値が伝わらない。
 * そのため ['me'] 以外だけを削除し、['me'] は setQueryData で更新する。
 */
export function setSessionUser(qc: QueryClient, user: Profile | null) {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
  qc.setQueryData(['me'], user);
}
