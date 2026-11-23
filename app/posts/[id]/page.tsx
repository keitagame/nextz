import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Spinner } from '@/components/PageHeader';
import { getPostMeta } from '@/lib/post-meta';
import { PostDetailView } from './post-detail';

/**
 * 外部共有（OGP）用のメタデータ。ポストごとに違うので generateMetadata で作る。
 * params（実行時データ）を使うため、下の DynamicMarker で「意図した動的レンダリング」だと Next.js に伝える（Cache Components の要件）。
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const n = Number(id);
  const fallback: Metadata = { title: 'ポスト' };
  if (!Number.isInteger(n) || n <= 0) return fallback;

  const m = await getPostMeta(n);
  if (!m) return fallback;

  const images = m.image ? [{ url: m.image }] : undefined;
  return {
    title: m.title,
    description: m.description || undefined,
    alternates: { canonical: `/posts/${n}` },
    openGraph: {
      type: 'article',
      siteName: 'Z',
      locale: 'ja_JP',
      url: `/posts/${n}`,
      title: m.ogTitle,
      description: m.description || undefined,
      publishedTime: m.createdAt,
      images,
    },
    twitter: {
      card: m.image && m.imageIsPost ? 'summary_large_image' : 'summary',
      title: m.ogTitle,
      description: m.description || undefined,
      images: m.image ? [m.image] : undefined,
    },
  };
}

async function Connection() {
  await connection();
  return null;
}

/** 何も描画しない。メタデータが実行時データに依存することを Next.js に伝えるための目印 */
function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  );
}

export default function PostDetailPage() {
  return (
    <>
      <Suspense fallback={<Spinner className="py-20" />}>
        <PostDetailView />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
