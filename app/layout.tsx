import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { Providers } from '@/components/Providers';
import { Spinner } from '@/components/PageHeader';
import { siteUrl } from '@/lib/url';

const font = Noto_Sans_JP({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  // OGP の画像や URL を絶対 URL にするための基準（本番では APP_URL を設定すること）
  metadataBase: new URL(siteUrl()),
  title: { default: 'Z', template: '%s / Z' },
  description: 'Zの再構築',
  openGraph: { type: 'website', siteName: 'Z', locale: 'ja_JP', title: 'Z', description: 'Zの再構築' },
  twitter: { card: 'summary', title: 'Z', description: 'Zの再構築' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

// 初回描画前にテーマと背景画像を適用してチラつきを防ぐ
const themeScript = `try{var r=document.documentElement,t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))r.classList.add('dark');var b=localStorage.getItem('bg-image');if(b&&/^data:image\\/jpeg;base64,[A-Za-z0-9+\\/=]+$/.test(b)){r.style.setProperty('--app-bg-image','url("'+b+'")');r.classList.add('has-bg')}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${font.className} min-h-screen bg-background antialiased flex justify-center`}>
        <Providers>
          {/* usePathname などの実行時フックを使うため Suspense で囲む（Cache Components の要件） */}
          <Suspense fallback={<Spinner className="py-40 w-full" />}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
