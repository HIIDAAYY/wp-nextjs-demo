import type { Metadata } from 'next';
import { situsUrl } from '@/lib/wp';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(situsUrl()),
  title: {
    default: 'Demo Headless WordPress + Next.js',
    template: '%s — Demo Headless WordPress + Next.js',
  },
  description:
    'Demo teknis: konten dari WordPress REST API, dirender statis oleh Next.js dengan ISR, metadata dinamis, JSON-LD, dan sitemap otomatis.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
