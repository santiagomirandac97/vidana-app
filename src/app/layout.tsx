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
  description: 'Impulsada por tecnología, diseñada para tu gente. Comedores, cafeterías y micro markets corporativos en México. Más de 2 millones de comidas servidas a empresas líderes.',
  keywords: ['comedor corporativo', 'comedores industriales', 'cafetería empresarial', 'micro market', 'alimentación corporativa', 'servicio de comedor', 'Vidana', 'México'],
  metadataBase: new URL('https://vidana.com.mx'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Vidana | Una experiencia de comedor corporativo más inteligente',
    description: 'Impulsada por tecnología, diseñada para tu gente. Comedores, cafeterías y micro markets corporativos en México.',
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
    description: 'Impulsada por tecnología, diseñada para tu gente. Comedores, cafeterías y micro markets corporativos en México.',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Vidana',
              url: 'https://vidana.com.mx',
              logo: 'https://vidana.com.mx/logos/logo.png',
              description: 'Alimentación corporativa de punta a punta. Comedores, cafeterías y micro markets diseñados para el bienestar de tu equipo.',
              email: 'hola@vidana.com.mx',
              sameAs: [
                'https://instagram.com/vidana_mx',
              ],
              contactPoint: {
                '@type': 'ContactPoint',
                email: 'hola@vidana.com.mx',
                contactType: 'sales',
                availableLanguage: 'Spanish',
              },
              areaServed: {
                '@type': 'Country',
                name: 'México',
              },
              serviceType: ['Comedores corporativos', 'Comedores industriales', 'Cafeterías empresariales', 'Micro markets'],
            }),
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <FirebaseProviderWrapper>
          {children}
          <Toaster />
        </FirebaseProviderWrapper>
      </body>
    </html>
  );
}
