import { open } from '@/lib/http';
import { getPending } from '@/lib/pending';
import { enabledProviders, providerName, suggestUsername } from '@/lib/oauth';

/** ログイン画面が最初に呼ぶ。使えるログイン方法と、途中状態（OAuth 新規登録の入力待ち）を返す */
export const GET = open(async () => {
  const providers = enabledProviders();
  const p = await getPending();
  if (p?.kind === 'oauth_signup') {
    const d = p.data as { provider?: string; name?: string; handle?: string };
    return {
      providers,
      pending: {
        kind: 'oauth_signup',
        providerName: providerName(String(d.provider ?? '')),
        suggestedUsername: suggestUsername(String(d.handle ?? '')),
        suggestedName: String(d.name ?? '').slice(0, 30),
      },
    };
  }
  return { providers, pending: null };
});
