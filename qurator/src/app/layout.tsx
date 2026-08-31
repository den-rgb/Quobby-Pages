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
      default: 'Qurator - Interactive Tutorials & Tutors for Any Topic',
      template: '%s | Qurator',
    },
    description:
      'Find tutors and interactive tutorials for board games, cooking, software, music, DIY, and more. Publish & sell your own — Premium members get up to 35% off. T&C apply.',
    keywords: [...BASE_SITE_KEYWORDS, ...catalogKeywords(catalog), 'board game strategy guide'],
    icons: { icon: '/app-icon.png', apple: '/app-icon.png' },
    openGraph: {
      title: 'Qurator - Interactive Tutorials & Tutors for Any Topic',
      description:
        'Find tutors and interactive tutorials. Publish & sell your own — Premium members get up to 35% off. T&C apply.',
      url: 'https://qurator.quobby.com',
      siteName: 'Qurator',
      images: [{ url: '/app-icon.png', width: 512, height: 512, alt: 'Qurator - Tutors and interactive tutorials' }],
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary',
      title: 'Qurator - Interactive Tutorials & Tutors',
      description:
        'Find tutors and interactive tutorials. Publish & sell your own — Premium members get up to 35% off. T&C apply.',
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
    'Find tutors and interactive, step-by-step tutorials. Publish & sell your own — Premium members get up to 35% off. T&C apply.',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList:
    'Find Tutors, Become a Tutor, Visual Flow Editor, Branching Logic, Community Tutorials, Video Processing, Board Game Designer, Embeddable Tutorials, Paid Tutorials, Premium Loyalty Discount',
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
