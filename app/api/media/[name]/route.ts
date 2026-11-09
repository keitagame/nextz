import fs from 'node:fs/promises';
import { MEDIA_NAME_RE, MIME, mediaPath } from '@/lib/media';

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!MEDIA_NAME_RE.test(name)) return new Response('Not found', { status: 404 });
  try {
    const data = await fs.readFile(mediaPath(name));
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': MIME[name.split('.')[1]],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
