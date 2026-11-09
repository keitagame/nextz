import { open, readJson, str, HttpError, clientIp } from '@/lib/http';
import { createSession, hashPassword, isSecureRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { getProfile } from '@/lib/users';
import { RESERVED_USERNAMES, USERNAME_RE } from '@/lib/text';


export const POST = open(async ({ req }) => {
  await rateLimit(`signup:${clientIp(req)}`, 10, 60 * 60 * 1000, 'アカウント作成の回数が上限に達しました。しばらくしてからお試しください');
  const body = await readJson(req);
  const username = str(body.username, 'ユーザー名', { min: 3, max: 15 });
  const name = str(body.name, '表示名', { min: 1, max: 30 });
  const password = str(body.password, 'パスワード', { min: 8, max: 128, trim: false });

  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'ユーザー名は半角英数字とアンダースコアのみ使用できます（3〜15文字）');
  if (RESERVED_USERNAMES.has(username.toLowerCase())) throw new HttpError(400, 'このユーザー名は使用できません');

  if (await db.get('SELECT 1 FROM users WHERE lower(username) = lower(?)', [username])) {
    throw new HttpError(409, 'このユーザー名はすでに使われています');
  }
  const hash = await hashPassword(password);
  let id: number;
  try {
    ({ lastId: id } = await db.run('INSERT INTO users (username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?) RETURNING id', [
      username,
      name,
      hash,
      Date.now(),
    ]));
  } catch {
    throw new HttpError(409, 'このユーザー名はすでに使われています');
  }
  await createSession(id, isSecureRequest(req));
  return { user: await getProfile(username, id) };
});
