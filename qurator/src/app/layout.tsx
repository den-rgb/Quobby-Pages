import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth';
import { BASE_SITE_KEYWORDS, catalogKeywords, getPublishedCatalog } from '@/lib/seo';
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/themes';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getPublishedCatalog();
  return {
    metadataBase: new URL('https://qurator.quobby.com'),
    title: {
      default: 'Qurator - Free Interactive Tutorial Maker for Any Topic',
      template: '%s | Qurator',
    },
    description:
      'Create and share free interactive tutorials for board games, cooking, software, music, DIY, and more. Visual flow editor with branching logic, quizzes, and video. Learn by doing, not reading.',
    keywords: [...BASE_SITE_KEYWORDS, ...catalogKeywords(catalog), 'board game strategy guide'],
    icons: { icon: '/app-icon.png', apple: '/app-icon.png' },
    openGraph: {
      title: 'Qurator - Free Interactive Tutorial Maker for Any Topic',
      description:
        'Create and share free interactive tutorials for board games, cooking, software, music, DIY, and more. Visual flow editor with branching logic, quizzes, and video.',
      url: 'https://qurator.quobby.com',
      siteName: 'Qurator',
      images: [{ url: '/app-icon.png', width: 512, height: 512, alt: 'Qurator - Interactive tutorials for anything' }],
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary',
      title: 'Qurator - Free Interactive Tutorial Maker for Any Topic',
      description:
        'Create and share free interactive tutorials for board games, cooking, software, music, and more. Learn by doing.',
      images: ['/app-icon.png'],
    },
    alternates: {
      canonical: 'https://qurator.quobby.com',
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  };
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Quobby',
  url: 'https://www.quobby.com',
  logo: 'https://qurator.quobby.com/app-icon.png',
  sameAs: ['https://www.instagram.com/quobby.official/'],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'helpmequobby@gmail.com',
    contactType: 'customer support',
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
  creator: organizationJsonLd,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground-secondary antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
        />
        <AuthProvider>
          <ThemeProvider>
            <Navbar />
            <main className="flex-1 pt-16">{children}</main>
            <Footer />
          </ThemeProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
