import 'server-only';

/**
 * 管理者アカウントは環境変数 ADMIN_USERNAMES（カンマ区切りのユーザー名。大文字小文字は区別しない）で指定する。
 *   例: ADMIN_USERNAMES=alice,bob
 *
 * 管理者は /admin から他のユーザーを凍結（BAN）・解除できる。
 * ユーザー名は変更できず一意なので、ユーザー名で管理者を判定している。
 * ただし先着順で登録されるため、管理者に指定するアカウントは本番公開の前に自分で作成しておくこと。
 */
function adminNames(): Set<string> {
  return new Set(
    (process.env.ADMIN_USERNAMES ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^@/, '').toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminUsername(username: string | null | undefined): boolean {
  return !!username && adminNames().has(username.toLowerCase());
}
