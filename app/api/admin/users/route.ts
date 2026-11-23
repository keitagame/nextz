import { adminOnly, cursorOf } from '@/lib/http';
import { db } from '@/lib/db';
import { ADMIN_USER_COLS, toAdminUser, type AdminUserRow } from '@/lib/moderation';

const PAGE = 20;

/** 管理者：ユーザー一覧（?q= で名前検索、?filter=banned で凍結中のみ）。凍結中のユーザーを先頭に出す */
export const GET = adminOnly(async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim().replace(/^@/, '').slice(0, 100);
  const onlyBanned = sp.get('filter') === 'banned';
  const offset = cursorOf(req, 0);

  const where: string[] = [];
  const args: Record<string, unknown> = { lim: PAGE + 1, off: offset };
  if (q) {
    where.push(`(u.username ILIKE @pat ESCAPE '\\' OR u.display_name ILIKE @pat ESCAPE '\\')`);
    args.pat = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  }
  if (onlyBanned) where.push('u.banned_at IS NOT NULL');

  const rows = await db.all<AdminUserRow>(
    `SELECT ${ADMIN_USER_COLS} FROM users u
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY (u.banned_at IS NOT NULL) DESC, u.id DESC
     LIMIT @lim OFFSET @off`,
    args,
  );
  return {
    items: rows.slice(0, PAGE).map(toAdminUser),
    nextCursor: rows.length > PAGE ? String(offset + PAGE) : null,
  };
});
