'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/UserAvatar';
import { api, errorMessage, uploadImage } from '@/lib/api';
import { toast, toastError } from '@/lib/toast';
import type { Profile } from '@/types/post';

export function EditProfileDialog({ user }: { user: Profile }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [location, setLocation] = useState(user.location);
  const [website, setWebsite] = useState(user.website);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState(user.bannerUrl);
  const [uploading, setUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  function reset() {
    setName(user.name); setBio(user.bio); setLocation(user.location);
    setWebsite(user.website); setAvatarUrl(user.avatarUrl); setBannerUrl(user.bannerUrl);
  }

  async function pick(file: File | undefined, set: (u: string) => void) {
    if (!file) return;
    setUploading(true);
    try {
      set(await uploadImage(file));
    } catch (e) {
      toastError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: () => api<{ user: Profile }>('/api/me', { method: 'PATCH', json: { name, bio, location, website, avatarUrl, bannerUrl } }),
    onSuccess: ({ user: updated }) => {
      qc.setQueryData(['me'], updated);
      qc.setQueryData(['profile', updated.username], updated);
      qc.invalidateQueries({ predicate: (q) => !['me', 'profile', 'counters'].includes(String(q.queryKey[0])) });
      toast('プロフィールを更新しました');
      setOpen(false);
    },
    onError: (e) => toastError(errorMessage(e)),
  });

  return (
    <>
      <Button
        variant="outline"
        className="rounded-full px-4 h-8 font-bold"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Edit3 className="w-4 h-4 mr-1" /> プロフィールを編集
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold">プロフィールを編集</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative h-28 rounded-lg bg-gradient-to-br from-muted to-accent overflow-hidden">
              {bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
              )}
              <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0], setBannerUrl); e.target.value = ''; }} />
              <button type="button" onClick={() => bannerRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/30 text-white hover:bg-black/40" aria-label="ヘッダー画像を変更">
                <Camera className="w-6 h-6" />
              </button>
              {bannerUrl && (
                <button type="button" onClick={() => setBannerUrl(null)} className="absolute top-1 left-1 text-xs bg-black/60 text-white rounded px-2 py-0.5">削除</button>
              )}
            </div>

            <div className="relative w-fit -mt-12 ml-3">
              <UserAvatar user={{ name, avatarUrl, avatarDecoration: user.avatarDecoration }} className="size-20 border-4 border-popover" />
              <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0], setAvatarUrl); e.target.value = ''; }} />
              <button type="button" onClick={() => avatarRef.current?.click()} className="absolute inset-1 rounded-full flex items-center justify-center bg-black/30 text-white hover:bg-black/40" aria-label="アイコンを変更">
                <Camera className="w-5 h-5" />
              </button>
            </div>

            <Field label="名前"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} /></Field>
            <Field label={`自己紹介 (${Array.from(bio).length}/160)`}>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={160} className="w-full p-2 text-sm rounded-lg border border-input bg-transparent" />
            </Field>
            <Field label="場所"><Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={30} /></Field>
            <Field label="ウェブサイト"><Input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={100} placeholder="https://" /></Field>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending || uploading || !name.trim()} className="w-full rounded-full font-bold h-10">
            {save.isPending ? '保存中...' : uploading ? 'アップロード中...' : '保存する'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="text-xs font-bold text-muted-foreground">{label}</span>
    {children}
  </label>
);
