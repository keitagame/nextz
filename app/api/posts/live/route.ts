import { open, viewerIdOf } from '@/lib/http';
import { liveFeed } from '@/lib/posts';

/** ホームのリアルタイム欄用。最新 8 件。ログイン不要 */
export const GET = open(async ({ viewer }) => liveFeed(viewerIdOf(viewer), 8));
