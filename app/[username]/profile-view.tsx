'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Ban, Calendar, Link as LinkIcon, Mail, MapPin, Settings, User } from 'lucide-react';
import { BanDialog, useUnban } from '@/components/BanDialog';
import { EditProfileDialog } from '@/components/EditProfileDialog';
import { FollowButton } from '@/components/FollowButton';
import { InfiniteList } from '@/components/InfiniteList';
import { EmptyState, PageHeader, Spinner, Tabs } from '@/components/PageHeader';
import { PostCard } from '@/components/PostCard';
import { UserAvatar } from '@/components/UserAvatar';
import { UserBadges } from '@/components/UserBadges';
import { Button } from '@/components/ui/button';
import { useInfiniteList } from '@/hooks/use-queries';
import { api, errorMessage } from '@/lib/api';
import { formatCount, formatMonth } from '@/lib/time';
import { toastError } from '@/lib/toast';
import type { FeedItem, Profile } from '@/types/post';

type TabId = 'posts' | 'replies' | 'media' | 'likes';

export function ProfileView() {
  const { username } = useParams<{ username: string }>();
  const profile = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => (await api<{ user: Profile }>(`/api/users/${username}`)).user,
  });

  if (profile.isPending) return <><PageHeader title="プロフィール" back /><Spinner /></>;
  if (profile.isError)
    return (
      <>
        <PageHeader title="プロフィール" back />
        <EmptyState icon={<User className="w-6 h-6" />} title="このアカウントは存在しません" description="別のユーザー名で検索してみてください。" />
      </>
    );
  return <ProfileBody key={profile.data.username} user={profile.data} />;
}

function ProfileBody({ user }: { user: Profile }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('posts');
  const [banOpen, setBanOpen] = useState(false);
  const unban = useUnban();
  const tabs = [
    { id: 'posts', label: 'ポスト' },
    { id: 'replies', label: '返信' },
    { id: 'media', label: 'メディア' },
    ...(user.isMe ? [{ id: 'likes' as const, label: 'いいね' }] : []),
  ] as { id: TabId; label: string }[];
  const list = useInfiniteList<FeedItem>(['user-posts', user.username, tab], `/api/users/${user.username}/posts?tab=${tab}`);

  async function startDm() {
    try {
      const r = await api<{ id: string }>('/api/dm', { method: 'POST', json: { username: user.username } });
      router.push(`/messages/${r.id}`);
    } catch (e) {
      toastError(errorMessage(e));
    }
  }

  const host = user.website ? user.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';

  return (
    <div className="min-h-screen pb-16">
      <PageHeader
        back
        title={
          <>
            <span className="truncate">{user.name}</span>
            <UserBadges user={user} />
          </>
        }
        subtitle={`${formatCount(user.postsCount)} ポスト`}
      />

      <div className="h-32 sm:h-48 bg-gradient-to-br from-muted to-accent relative">
        {user.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.bannerUrl} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="flex justify-between items-end -mt-12 sm:-mt-16 mb-3">
          <UserAvatar user={user} className="size-24 sm:size-32 border-4 border-background shadow-md [&_*]:text-3xl" />
          <div className="flex items-center gap-2">
            {user.isMe ? (
              <>
                {/* スマホにはサイドバーがないので、設定画面への入口をここに置く */}
                <Link
                  href="/settings"
                  className="sm:hidden inline-flex items-center justify-center size-8 rounded-full border border-input hover:bg-accent transition-colors"
                  aria-label="設定"
                >
                  <Settings className="w-4 h-4" />
                </Link>
                <EditProfileDialog user={user} />
              </>
            ) : (
              <>
                <Button variant="outline" size="icon" className="rounded-full size-8" onClick={startDm} aria-label="メッセージを送る">
                  <Mail className="w-4 h-4" />
                </Button>
                <FollowButton username={user.username} isFollowing={user.isFollowing} />
                {/* 管理者だけに出る。管理者アカウントへの操作はサーバー側で拒否される */}
                {user.viewerIsAdmin &&
                  (user.isBanned ? (
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => unban(user.username)}>凍結を解除</Button>
                  ) : (
                    <Button variant="destructive" size="sm" className="rounded-full" onClick={() => setBanOpen(true)}>
                      <Ban /> 凍結
                    </Button>
                  ))}
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-1">
              {user.name}
              <UserBadges user={user} className="size-6" />
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              @{user.username}
              {user.followsYou && <span className="bg-muted px-1.5 py-0.5 rounded text-[11px]">フォローされています</span>}
            </p>
          </div>

          {user.isBanned && (
            <p role="status" className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm font-bold">
              このアカウントは利用規約違反のため凍結されています
            </p>
          )}

          {user.bio && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground/90">{user.bio}</p>}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {user.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {user.location}</span>}
            {host && (
              <span className="flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5" />
                <a href={user.website} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-primary hover:underline">{host}</a>
              </span>
            )}
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatMonth(user.createdAt)}から利用しています</span>
          </div>

          <div className="flex gap-4 text-sm pt-1">
            <Link href={`/${user.username}/following`} className="hover:underline">
              <strong>{formatCount(user.followingCount)}</strong> <span className="text-muted-foreground">フォロー中</span>
            </Link>
            <Link href={`/${user.username}/followers`} className="hover:underline">
              <strong>{formatCount(user.followersCount)}</strong> <span className="text-muted-foreground">フォロワー</span>
            </Link>
          </div>
        </div>
      </div>

      <BanDialog target={banOpen ? { username: user.username, name: user.name } : null} onClose={() => setBanOpen(false)} />

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="border-b border-border/60" />

      <InfiniteList
        query={list}
        render={(i) => <PostCard post={i.post} repostedBy={i.repostedBy} />}
        empty={<EmptyState title={tab === 'media' ? 'メディアはまだありません' : tab === 'likes' ? 'いいねしたポストはまだありません' : 'ポストはまだありません'} />}
      />
    </div>
  );
}
