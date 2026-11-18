import { humanOnly } from '@/lib/http';
import { hasUsablePassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { enabledProviders } from '@/lib/oauth';

/** 設定画面用：メール・連携アカウントの現在の状態 */
export const GET = humanOnly(async ({ viewer }) => {
  const u = await db.get<{ email: string | null; email_verified_at: number | null; password_hash: string }>(
    'SELECT email, email_verified_at, password_hash FROM users WHERE id = ?',
    [viewer.idNum],
  );
  const links = await db.all<{ provider: string; email: string | null; created_at: number }>('SELECT provider, email, created_at FROM oauth_accounts WHERE user_id = ? ORDER BY created_at', [viewer.idNum]);
  return {
    email: u?.email ?? null,
    emailVerified: !!u?.email_verified_at,
    hasPassword: hasUsablePassword(u?.password_hash),
    identities: links.map((l) => ({ provider: l.provider, email: l.email, linkedAt: l.created_at })),
    providers: enabledProviders(),
  };
});
