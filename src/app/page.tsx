
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Loader2 } from 'lucide-react';

// This page now acts as the main entry point and redirector.
export default function HomeRedirector() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // If user is logged in, decide where to send them based on role.
        // We will fetch the profile here just for this initial redirection.
        // AuthGuard will handle protection on subsequent navigations.
        const fetchProfileAndRedirect = async () => {
          try {
            const token = await user.getIdTokenResult();
            // Assuming role is stored in custom claims, which is a common pattern.
            // If not, we'd need a quick Firestore fetch. For now, let's assume 'admin' claim.
            const isAdmin = token.claims.role === 'admin';
            router.replace(isAdmin ? '/selection' : '/main');
          } catch {
             // Fallback for non-admin or error fetching profile
            router.replace('/main');
          }
        };
        fetchProfileAndRedirect();
      } else {
        // If no user, always go to login.
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="ml-3 text-lg">Cargando...</p>
    </div>
  );
}
