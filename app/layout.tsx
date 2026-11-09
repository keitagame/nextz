import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { Providers } from '@/components/Providers';
import { Spinner } from '@/components/PageHeader';

const font = Noto_Sans_JP({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Z', template: '%s / Z' },
  description: 'Zの再構築',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfe' },
    { media: '(prefers-color-scheme: dark)', color: '#14141c' },
  ],
};

// 初回描画前にテーマを適用してチラつきを防ぐ
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

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
