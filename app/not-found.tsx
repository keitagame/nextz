import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="p-12 text-center space-y-3">
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <p className="text-sm text-muted-foreground">お探しのページは存在しないか、移動した可能性があります。</p>
      <Link href="/" className="inline-block text-primary font-bold hover:underline">ホームへ戻る</Link>
    </div>
  );
}
