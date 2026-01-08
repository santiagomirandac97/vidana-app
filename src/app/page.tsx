
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { type UserProfile } from '@/lib/types';

export default function HomeRedirector() {
  const { user, isLoading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();

  // Get user profile to check for role
  const userProfileRef = useMemoFirebase(() => 
    firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const isLoading = userLoading || (user && profileLoading);

  useEffect(() => {
    // Wait until all loading is complete
    if (isLoading) {
      return;
    }

    // If there is no user, redirect to login
    if (!user) {
      router.replace('/login');
      return;
    }

    // If we have a user, check their profile and role
    if (userProfile) {
      if (userProfile.role === 'admin') {
        router.replace('/selection');
      } else {
        router.replace('/main');
      }
    } else {
      // This case can happen briefly if the user exists but the profile doc hasn't been read yet.
      // If after loading, there's still no profile, it's safest to send to login to be safe.
      // A more robust solution might attempt to create a profile here if one is missing.
      if (!profileLoading) {
         router.replace('/login');
      }
    }
  }, [user, userProfile, isLoading, profileLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="ml-3 text-lg">Redirigiendo...</p>
    </div>
  );
}
