import { open } from '@/lib/http';
import { trends } from '@/lib/posts';

export const GET = open(async () => ({ items: await trends(10) }));
