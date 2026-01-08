
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
        // We get the role from custom claims in the ID token for performance.
        const fetchProfileAndRedirect = async () => {
          try {
            // Force a token refresh to get the latest custom claims.
            const tokenResult = await user.getIdTokenResult(true);
            const isAdmin = tokenResult.claims.role === 'admin';
            
            if (isAdmin) {
                router.replace('/selection');
            } else {
                router.replace('/main');
            }
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
