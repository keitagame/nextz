import { authed } from '@/lib/http';
import { trends } from '@/lib/posts';

export const GET = authed(async () => ({ items: await trends(10) }));
