import 'server-only';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import type { LinkPreviewData } from '@/types/post';

/**
 * 外部 URL の OGP（タイトル・説明・画像）を取得する。タイムラインのリンクカード用。
 *
 * ユーザーが入力した URL をサーバーが取りに行くため、SSRF（内部ネットワークへの到達）対策が最重要:
 *   - http / https のみ、ポートは 80 / 443 のみ
 *   - 接続時に名前解決した IP を検査する（lookup を差し替え）ので、DNS リバインディングも防げる。IP 直指定も事前に検査
 *   - プライベート・ループバック・リンクローカル・クラウドのメタデータ（169.254.169.254）などは拒否
 *   - リダイレクトは自分で追い、1 回ごとに同じ検査をする（最大 3 回）
 *   - タイムアウト 6 秒 / 読み込みは先頭 512KB まで / HTML 以外は読まない
 */

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 6000;

const blocked = new net.BlockList();
for (const [addr, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(addr, bits, 'ipv4');
}
for (const [addr, bits] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96], // NAT64
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(addr, bits, 'ipv6');
}

/** IPv6 を 8 個の 16bit に展開する（::1 や ::ffff:1.2.3.4 のような省略・IPv4 末尾表記にも対応） */
function expandV6(ip: string): number[] | null {
  let s = ip.split('%')[0].toLowerCase();
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    s = s.slice(0, v4.index) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const [head, tail, extra] = s.split('::');
  if (extra !== undefined) return null;
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const fill = tail === undefined ? 0 : 8 - h.length - t.length;
  if (fill < 0 || (tail === undefined && h.length !== 8)) return null;
  const groups = [...h, ...Array(fill).fill('0'), ...t].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (!family) return true;
  if (family === 6) {
    const g = expandV6(ip);
    if (!g) return true;
    // IPv4 マッピング ::ffff:a.b.c.d は丸ごと拒否する。
    // （net.BlockList に ::ffff:0:0/96 を入れると、普通の IPv4 まで全部一致してしまうため自前で判定する）
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return true;
  }
  return blocked.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

/** 接続直前の名前解決。1 つでも禁止アドレスがあれば接続しない */
const safeLookup = ((hostname: string, options: dns.LookupOptions, cb: (...a: unknown[]) => void) => {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some((a) => isBlockedIp(a.address))) return cb(new Error('blocked address'));
    if (options?.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}) as unknown as net.LookupFunction;

export function parsePublicUrl(raw: string): URL | null {
  if (raw.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null;
  // IP 直指定は lookup を通らないのでここで検査する
  if (net.isIP(host) && isBlockedIp(host)) return null;
  return u;
}

interface Fetched {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

function fetchOnce(url: URL, userAgent: string): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const req = lib.request(
      url,
      {
        method: 'GET',
        lookup: safeLookup,
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'Accept-Language': 'ja,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        // リダイレクトと HTML 以外は本文を読まない
        const type = String(res.headers['content-type'] ?? '').toLowerCase();
        if (status >= 300 && status < 400) {
          res.resume();
          return done(() => resolve({ status, headers: res.headers, body: Buffer.alloc(0) }));
        }
        if (status !== 200 || !/(text\/html|application\/xhtml\+xml)/.test(type)) {
          res.resume();
          return done(() => resolve({ status: status === 200 ? 415 : status, headers: res.headers, body: Buffer.alloc(0) }));
        }

        const enc = String(res.headers['content-encoding'] ?? '').toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        // 途中で読み切って打ち切るので、末尾が欠けていてもエラーにしない（SYNC_FLUSH）
        if (enc === 'gzip') stream = res.pipe(zlib.createGunzip({ finishFlush: zlib.constants.Z_SYNC_FLUSH }));
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate({ finishFlush: zlib.constants.Z_SYNC_FLUSH }));
        else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress({ finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH }));

        const chunks: Buffer[] = [];
        let size = 0;
        const finish = () => done(() => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on('data', (c: Buffer) => {
          chunks.push(c);
          size += c.length;
          if (size >= MAX_BYTES) {
            req.destroy();
            finish();
          }
        });
        stream.on('end', finish);
        // 展開エラーや切断でも、それまでに読めた分があれば使う
        const fail = (e: Error) => (size > 0 ? finish() : done(() => reject(e)));
        stream.on('error', fail);
        res.on('error', fail);
      },
    );
    const timer = setTimeout(() => {
      req.destroy();
      done(() => reject(new Error('timeout')));
    }, TIMEOUT_MS);
    req.on('error', (e) => done(() => reject(e)));
    req.end();
  });
}

function decodeBody(body: Buffer, contentType: string): string {
  let charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (!charset) {
    // <meta charset> / <meta http-equiv content="...charset="> は先頭付近にある
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 4096).toString('latin1'))?.[1];
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(body); // Shift_JIS / EUC-JP の日本語サイトにも対応
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
      } catch {
        return m;
      }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s: string | undefined, max: number) => {
  const t = decodeEntities(s ?? '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(t);
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : t;
};

export function parseOgp(html: string, finalUrl: URL): LinkPreviewData | null {
  const head = html.slice(0, html.search(/<\/head>/i) > 0 ? html.search(/<\/head>/i) : 200_000);
  const meta = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    }
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content !== undefined && !meta.has(key)) meta.set(key, attrs.content);
  }
  const pageTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];

  const title = clean(meta.get('og:title') || meta.get('twitter:title') || pageTitle, 150);
  const description = clean(meta.get('og:description') || meta.get('twitter:description') || meta.get('description'), 300);

  let image: string | null = null;
  const rawImage = decodeEntities(meta.get('og:image') || meta.get('og:image:url') || meta.get('twitter:image') || '').trim();
  if (rawImage) {
    try {
      const u = new URL(rawImage, finalUrl);
      if (u.protocol === 'https:' && u.href.length <= 2048) image = u.href;
      else if (u.protocol === 'http:' && finalUrl.protocol === 'http:') image = null; // 混在コンテンツになるので使わない
    } catch {
      /* 画像なし */
    }
  }

  if (!title && !image) return null;
  const domain = finalUrl.hostname.replace(/^www\./, '');
  return {
    url: finalUrl.href,
    domain,
    title: title || domain,
    description,
    image,
    siteName: clean(meta.get('og:site_name'), 60),
  };
}

/** URL の OGP を取得する。取得できない・対象外の URL は null（例外は投げない） */
export async function fetchLinkPreview(raw: string, userAgent: string): Promise<LinkPreviewData | null> {
  let url = parsePublicUrl(raw);
  try {
    for (let i = 0; url && i <= MAX_REDIRECTS; i++) {
      const r = await fetchOnce(url, userAgent);
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.location;
        url = loc ? parsePublicUrl(new URL(loc, url).href) : null;
        continue;
      }
      if (r.status !== 200 || r.body.length === 0) return null;
      return parseOgp(decodeBody(r.body, String(r.headers['content-type'] ?? '')), url);
    }
  } catch {
    /* 接続失敗・禁止アドレス・タイムアウトなどはすべて「プレビューなし」 */
  }
  return null;
}
