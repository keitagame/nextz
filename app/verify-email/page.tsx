import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { VerifyEmailView } from './verify-email-view';

export const metadata: Metadata = { title: 'メールアドレスの確認' };

/** 確認メールのリンクの行き先。ログインしていなくても開ける（AppShell は /verify-email を認証ゲートに通さない） */
export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen">
      <PageHeader title="メールアドレスの確認" back />
      <VerifyEmailView />
    </div>
  );
}
