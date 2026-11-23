import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { TermsContent } from '@/components/TermsContent';

export const metadata: Metadata = { title: '利用規約' };

/** 利用規約。ログインしていなくても読める（AppShell が /terms だけ認証ゲートを通さない） */
export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <PageHeader title="利用規約" back />
      <div className="p-4 pb-20">
        <TermsContent />
      </div>
    </div>
  );
}
