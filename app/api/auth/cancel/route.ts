import { open } from '@/lib/http';
import { clearPending } from '@/lib/pending';

/** OAuth 新規登録の入力待ちをやめて、最初の画面に戻る */
export const POST = open(async () => {
  await clearPending();
  return { ok: true };
});
