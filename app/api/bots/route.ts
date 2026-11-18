import { humanOnly, readJson, str, HttpError } from '@/lib/http';
import { db, transaction } from '@/lib/db';
import { generateBotToken } from '@/lib/auth';
import { BOT_COLS, getBot, MAX_BOTS_PER_USER, toBot } from '@/lib/bots';
import { rateLimit } from '@/lib/ratelimit';
import { RESERVED_USERNAMES, USERNAME_RE } from '@/lib/text';

/** 自分のボット一覧 */
export const GET = humanOnly(async ({ viewer }) => {
  const rows = await db.all<Parameters<typeof toBot>[0]>(
    `SELECT ${BOT_COLS} FROM bots b JOIN users u ON u.id = b.user_id WHERE b.owner_id = ? ORDER BY b.created_at DESC`,
    [viewer.idNum],
  );
  return { items: rows.map(toBot), max: MAX_BOTS_PER_USER };
});

/** ボットを作成する。トークンはこのレスポンスでしか返さない */
export const POST = humanOnly(async ({ req, viewer }) => {
  await rateLimit(`bot-create:${viewer.idNum}`, 10, 60 * 60 * 1000);
  const body = await readJson(req);
  const username = str(body.username, 'ユーザー名', { min: 3, max: 15 });
  const name = str(body.name, '表示名', { min: 1, max: 30 });
  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'ユーザー名は半角英数字とアンダースコアのみ使用できます（3〜15文字）');
  if (RESERVED_USERNAMES.has(username.toLowerCase())) throw new HttpError(400, 'このユーザー名は使用できません');

  const count = await db.get<{ c: number }>('SELECT COUNT(*) AS c FROM bots WHERE owner_id = ?', [viewer.idNum]);
  if ((count?.c ?? 0) >= MAX_BOTS_PER_USER) throw new HttpError(400, `ボットは${MAX_BOTS_PER_USER}個まで作成できます`);
  if (await db.get('SELECT 1 FROM users WHERE lower(username) = lower(?)', [username])) {
    throw new HttpError(409, 'このユーザー名はすでに使われています');
  }

  const { token, hash, prefix } = generateBotToken();
  const now = Date.now();
  let botId: number;
  try {
    botId = await transaction(async (tx) => {
      // パスワードは "bot:disabled"（scrypt 形式ではない）なので、パスワードでのログインは常に失敗する
      const { lastId } = await tx.run('INSERT INTO users (username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?) RETURNING id', [
        username,
        name,
        'bot:disabled',
        now,
      ]);
      await tx.run('INSERT INTO bots (user_id, owner_id, token_hash, token_prefix, created_at) VALUES (?, ?, ?, ?, ?)', [lastId, viewer.idNum, hash, prefix, now]);
      return lastId;
    });
  } catch {
    throw new HttpError(409, 'このユーザー名はすでに使われています');
  }
  return { bot: await getBot(botId), token };
});
