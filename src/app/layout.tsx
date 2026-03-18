import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { FirebaseProviderWrapper } from '@/components/firebase-provider-wrapper';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#000000',
};

export const metadata: Metadata = {
  title: 'Vidana | Una experiencia de comedor corporativo más inteligente',
  description: 'Impulsada por tecnología, diseñada para tu gente. Comedores, cafeterías y micro markets corporativos. Más de 2 millones de comidas servidas.',
  metadataBase: new URL('https://vidana.com.mx'),
  openGraph: {
    title: 'Vidana | Una experiencia de comedor corporativo más inteligente',
    description: 'Impulsada por tecnología, diseñada para tu gente. Comedores, cafeterías y micro markets corporativos.',
    url: 'https://vidana.com.mx',
    siteName: 'Vidana',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Vidana - Comedor corporativo inteligente',
      },
    ],
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vidana | Una experiencia de comedor corporativo más inteligente',
    description: 'Impulsada por tecnología, diseñada para tu gente. Comedores, cafeterías y micro markets corporativos.',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        <FirebaseProviderWrapper>
          {children}
          <Toaster />
        </FirebaseProviderWrapper>
      </body>
    </html>
  );
}
