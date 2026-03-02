'use client';

import dynamic from 'next/dynamic';

// firebase/auth accesses localStorage at module-import time, which crashes
// Next.js SSR. Wrapping with dynamic + ssr:false ensures Firebase is only
// imported on the client.
const FirebaseClientProvider = dynamic(
  () => import('@/firebase').then((m) => ({ default: m.FirebaseClientProvider })),
  { ssr: false }
);

export function FirebaseProviderWrapper({ children }: { children: React.ReactNode }) {
  return <FirebaseClientProvider>{children}</FirebaseClientProvider>;
}
