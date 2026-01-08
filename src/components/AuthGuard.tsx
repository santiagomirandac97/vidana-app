
'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { type UserProfile } from '@/lib/types';

// List of public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/signup', '/reset-password'];

// Admin-only routes
const ADMIN_ROUTES = ['/admin', '/selection', '/configuracion', '/kiosk', '/pos-inditex', '/command'];

// Default route for authenticated non-admin users
const USER_DEFAULT_ROUTE = '/main';

// Default route for authenticated admin users
const ADMIN_DEFAULT_ROUTE = '/selection';

// Default route for unauthenticated users
const LOGIN_ROUTE = '/login';


/**
 * A component that guards routes based on user authentication status and role.
 * It handles redirection and displays a loading screen while verifying auth state.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();

  // Memoize the user profile document reference
  const userProfileRef = useMemoFirebase(() => 
    firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const isLoading = userLoading || (user && profileLoading);

  useEffect(() => {
    // Wait until all loading is complete before making any routing decisions
    if (isLoading) {
      return;
    }

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isAdminRoute = ADMIN_ROUTES.includes(pathname);

    // If user is not authenticated
    if (!user) {
      // If the current route is not public, redirect to login
      if (!isPublicRoute) {
        router.replace(LOGIN_ROUTE);
      }
      return;
    }
    
    // If user is authenticated
    if (userProfile) {
        const isAdmin = userProfile.role === 'admin';

        // If trying to access an admin route without admin role
        if (isAdminRoute && !isAdmin) {
            router.replace(USER_DEFAULT_ROUTE);
            return;
        }

        // If trying to access a public route while logged in, redirect to default
        if (isPublicRoute) {
            router.replace(isAdmin ? ADMIN_DEFAULT_ROUTE : USER_DEFAULT_ROUTE);
            return;
        }

        // If the user lands on the root page, redirect them based on their role
        if (pathname === '/') {
           router.replace(isAdmin ? ADMIN_DEFAULT_ROUTE : USER_DEFAULT_ROUTE);
           return;
        }
    } else if (!profileLoading) {
      // This case handles a logged-in user with no profile document.
      // This might happen if the doc creation failed. Safest to send to login.
      router.replace(LOGIN_ROUTE);
    }

  }, [user, userProfile, isLoading, profileLoading, pathname, router]);

  // Determine if we should show the loading screen
  const isAuthCheckRunning = isLoading;
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const showLoading = !isPublicRoute && (isAuthCheckRunning || !user);

  if (showLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-3 text-lg">Verificando acceso...</p>
      </div>
    );
  }

  return <>{children}</>;
}
