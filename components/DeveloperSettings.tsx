'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot as BotIcon, Check, Copy, KeyRound, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/UserAvatar';
import { api, errorMessage } from '@/lib/api';
import { USERNAME_RE } from '@/lib/text';
import { formatRelative } from '@/lib/time';
import { toast, toastError } from '@/lib/toast';
import type { Bot } from '@/types/post';

type BotList = { items: Bot[]; max: number };
type Issued = { bot: Bot; token: string };

function CopyButton({ text, label = 'コピー' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toastError('コピーできませんでした。手動で選択してコピーしてください');
        }
      }}
    >
      {done ? <Check /> : <Copy />} {done ? 'コピーしました' : label}
    </Button>
  );
}

const ENDPOINTS: [string, string, string][] = [
  ['GET', '/api/me', '自分（ボット）の情報'],
  ['PATCH', '/api/me', 'プロフィール更新（name / bio / avatarUrl など）'],
  ['POST', '/api/posts', 'ポスト投稿（content, images, parentId, quoteOf）'],
  ['GET', '/api/posts?feed=following', 'タイムライン取得'],
  ['DELETE', '/api/posts/:id', 'ポスト削除'],
  ['POST', '/api/posts/:id/like', 'いいね（DELETE で解除）。repost / bookmark も同様'],
  ['PUT', '/api/posts/:id/reactions/:emojiId', '絵文字リアクション'],
  ['GET', '/api/notifications', '通知（メンション・返信など）の取得'],
  ['POST', '/api/users/:username/follow', 'フォロー（DELETE で解除）'],
  ['POST', '/api/dm', 'DM スレッド取得／作成（username）。メッセージ送信は /api/dm/:id'],
  ['POST', '/api/channels/:id/posts', 'チャンネルへ投稿（メンバーのみ）'],
  ['POST', '/api/upload', '画像アップロード（multipart, file）→ url'],
];

/** 設定 → 開発者：ボットアカウントの作成と API トークンの管理 */
export function DeveloperSection() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ['bots'], queryFn: () => api<BotList>('/api/bots') });
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [issued, setIssued] = useState<Issued | null>(null);

  const uname = username.trim();
  const valid = USERNAME_RE.test(uname) && name.trim().length > 0;
  const atMax = !!data && data.items.length >= data.max;
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const create = useMutation({
    mutationFn: () => api<Issued>('/api/bots', { method: 'POST', json: { username: uname, name: name.trim() } }),
    onSuccess: (r) => {
      setIssued(r);
      setUsername('');
      setName('');
      qc.invalidateQueries({ queryKey: ['bots'] });
      toast('ボットを作成しました');
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  const regen = useMutation({
    mutationFn: (id: string) => api<Issued>(`/api/bots/${id}/token`, { method: 'POST' }),
    onSuccess: (r) => {
      setIssued(r);
      qc.invalidateQueries({ queryKey: ['bots'] });
      toast('トークンを再発行しました。古いトークンは使えなくなります');
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/bots/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      setIssued((cur) => (cur?.bot.id === id ? null : cur));
      qc.invalidateQueries({ queryKey: ['bots'] });
      toast('ボットを削除しました');
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  return (
    <section className="p-4 space-y-4" id="developer">
      <div>
        <h2 className="font-bold flex items-center gap-2">
          <BotIcon className="size-4" /> 開発者
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          ボット用のアカウントと API トークンを作成できます。ボットは「BOT」バッジ付きの専用アカウントとして、ポスト・返信・DM などを API から行えます。
        </p>
      </div>

      {issued && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2" role="status">
          <p className="text-sm font-bold">@{issued.bot.username} の API トークン</p>
          <p className="text-xs text-muted-foreground">このトークンは今しか表示されません。安全な場所に保存してください。パスワードと同じように扱い、他人に見せないでください。</p>
          <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs select-all">{issued.token}</code>
          <div className="flex gap-2">
            <CopyButton text={issued.token} label="トークンをコピー" />
            <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setIssued(null)}>
              閉じる
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-bold">あなたのボット{data && ` (${data.items.length}/${data.max})`}</h3>
        {isPending ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : data?.items.length ? (
          <ul className="space-y-2">
            {data.items.map((b) => (
              <li key={b.id} className="rounded-xl border p-3 flex items-center gap-3 flex-wrap">
                <UserAvatar user={{ name: b.name, avatarUrl: b.avatarUrl }} className="size-10" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate">
                    {b.name} <span className="rounded border px-1 text-[10px] leading-4 text-muted-foreground align-middle">BOT</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{b.username} ・ <code>{b.tokenPrefix}…</code> ・ {b.lastUsedAt ? `最終使用 ${formatRelative(b.lastUsedAt)}` : '未使用'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={regen.isPending}
                    onClick={() => confirm(`@${b.username} のトークンを再発行しますか？\n古いトークンはすぐに使えなくなります。`) && regen.mutate(b.id)}
                  >
                    <KeyRound /> トークン再発行
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-full"
                    disabled={remove.isPending}
                    onClick={() => confirm(`@${b.username} を削除しますか？\nボットの投稿などのデータもすべて消え、元に戻せません。`) && remove.mutate(b.id)}
                  >
                    <Trash2 /> 削除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">まだボットがありません。</p>
        )}
      </div>

      <form
        className="space-y-2 max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !atMax) create.mutate();
        }}
      >
        <h3 className="text-sm font-bold">ボットを作成</h3>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ユーザー名（半角英数字と _ ・3〜15文字）" maxLength={15} aria-label="ボットのユーザー名" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="h-10" />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="表示名" maxLength={30} aria-label="ボットの表示名" className="h-10" />
        <Button type="submit" disabled={!valid || atMax || create.isPending} className="rounded-full font-bold px-5">
          作成する
        </Button>
        {atMax && <p className="text-xs text-muted-foreground">ボットは{data?.max}個まで作成できます。</p>}
      </form>

      <details className="rounded-xl border p-3 text-sm">
        <summary className="cursor-pointer font-bold">API の使い方</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            すべてのリクエストに <code>Authorization: Bearer &lt;トークン&gt;</code> ヘッダーを付けます。レスポンスは JSON、エラーは <code>{'{ "error": "…" }'}</code> です。1 分あたり 120 リクエストまで。
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">{`curl -X POST ${origin || 'https://your-site.example'}/api/posts \\
  -H "Authorization: Bearer nzb_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"content":"Hello from my bot!"}'`}</pre>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                {ENDPOINTS.map(([m, p, d]) => (
                  <tr key={m + p} className="border-t first:border-t-0 align-top">
                    <td className="py-1.5 pr-2 font-mono font-bold whitespace-nowrap">{m}</td>
                    <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{p}</td>
                    <td className="py-1.5 text-muted-foreground">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">パスワード変更やボットの管理など、アカウント自体に関わる操作はボットのトークンでは行えません。</p>
        </div>
      </details>
    </section>
  );
}
