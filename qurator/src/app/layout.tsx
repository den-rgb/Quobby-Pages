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
  metadataBase: new URL('https://qurator.quobby.com'),
  title: {
    default: 'Qurator - Interactive Tutorials for Anything',
    template: '%s | Qurator',
  },
  description:
    'Create and follow interactive tutorials for board games, cooking, software, music, and more. Learn by doing, not reading.',
  icons: { icon: '/app-icon.png', apple: '/app-icon.png' },
  openGraph: {
    title: 'Qurator - Interactive Tutorials for Anything',
    description:
      'Create and follow interactive tutorials for board games, cooking, software, music, and more. Learn by doing, not reading.',
    url: 'https://qurator.quobby.com',
    siteName: 'Qurator',
    images: [{ url: '/app-icon.png', width: 512, height: 512, alt: 'Qurator' }],
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'Qurator - Interactive Tutorials for Anything',
    description:
      'Create and follow interactive tutorials for board games, cooking, software, music, and more.',
    images: ['/app-icon.png'],
  },
  alternates: {
    canonical: 'https://qurator.quobby.com',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const webAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Qurator',
  url: 'https://qurator.quobby.com',
  description:
    'A community-driven platform for creating and following interactive, step-by-step tutorials for board games, cooking, software, music, DIY, and more.',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList:
    'Visual Flow Editor, Branching Logic, Community Tutorials, Video Processing, Board Game Designer, Embeddable Tutorials',
  creator: {
    '@type': 'Organization',
    name: 'Quobby',
    url: 'https://www.quobby.com',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full dark`}>
      <body className="min-h-full flex flex-col bg-background text-foreground-secondary antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
        />
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
