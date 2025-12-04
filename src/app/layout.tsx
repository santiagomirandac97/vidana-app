
"use client";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { useFirebase } from "@/firebase";
import { Loader2 } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

// This can't be set in the root layout with server components
// export const metadata: Metadata = {
//   title: "RGSTR",
//   description: "Registro de Comidas para Empresas",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { app, firestore, auth } = useFirebase();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {app && firestore && auth ? children : (
          <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-3 text-lg">Cargando...</p>
          </div>
        )}
        <Toaster />
      </body>
    </html>
  );
}
