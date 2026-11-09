import { open } from '@/lib/http';
import { destroySession } from '@/lib/auth';

export const POST = open(async () => {
  await destroySession();
  return { ok: true };
});
