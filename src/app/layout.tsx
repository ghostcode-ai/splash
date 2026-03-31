import type { Metadata } from 'next';
import { Space_Mono, Syne } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ghostcode.ai — Step Into the Unknown',
  description:
    'We build in the spaces between what is known and what is possible.',
  openGraph: {
    title: 'ghostcode.ai',
    description: 'Step into the unknown.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${syne.variable}`}>
      <body>{children}<Analytics /></body>
    </html>
  );
}
