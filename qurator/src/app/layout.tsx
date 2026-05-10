import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';
import { AuthProvider } from '@/lib/auth';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Qurator - Interactive Tutorials for Anything',
  description:
    'Create and follow interactive tutorials for board games, cooking, software, music, and more. Learn by doing, not reading.',
  icons: { icon: '/app-icon.png', apple: '/app-icon.png' },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full dark`}>
      <body className="min-h-full flex flex-col bg-background text-foreground-secondary antialiased">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,0,81,0.15),transparent_60%),radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,0,81,0.06),transparent_50%),linear-gradient(180deg,var(--color-background)_0%,var(--color-background-secondary)_100%)]" />
        <AuthProvider>
          <Navbar />
          <main className="flex-1 pt-16">{children}</main>
          <Footer />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
