
"use client";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { useFirebase } from "@/firebase";

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
  const { app, firestore } = useFirebase();

  return (
    <html lang="en">
      <body className={inter.className}>
        {app && firestore ? children : <div className="flex h-screen items-center justify-center">Cargando...</div>}
        <Toaster />
      </body>
    </html>
  );
}
