import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { FirebaseProviderWrapper } from '@/components/firebase-provider-wrapper';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vidana',
  description: 'Gestión de comedores empresariales',
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
