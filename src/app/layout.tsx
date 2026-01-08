
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase";
import AuthGuard from "@/components/AuthGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RGSTR",
  description: "Registro de Comidas para Empresas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <FirebaseClientProvider>
          <AuthGuard>{children}</AuthGuard>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
