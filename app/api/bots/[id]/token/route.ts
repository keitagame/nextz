import { humanOnly } from '@/lib/http';
import { db } from '@/lib/db';
import { generateBotToken } from '@/lib/auth';
import { getBot, ownedBotId } from '@/lib/bots';
import { rateLimit } from '@/lib/ratelimit';

/** トークンを再発行する。古いトークンは即座に無効になる */
export const POST = humanOnly(async ({ params, viewer }) => {
  await rateLimit(`bot-token:${viewer.idNum}`, 20, 60 * 60 * 1000);
  const id = await ownedBotId(params.id, viewer.idNum);
  const { token, hash, prefix } = generateBotToken();
  await db.run('UPDATE bots SET token_hash = ?, token_prefix = ?, last_used_at = NULL WHERE user_id = ?', [hash, prefix, id]);
  return { bot: await getBot(id), token };
});
