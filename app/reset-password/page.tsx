import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { ResetPasswordView } from './reset-password-view';

export const metadata: Metadata = { title: 'パスワードの再設定' };

/** 再設定メールのリンクの行き先。ログインしていなくても開ける（AppShell は /reset-password を認証ゲートに通さない） */
export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen">
      <PageHeader title="パスワードの再設定" back />
      <ResetPasswordView />
    </div>
  );
}
