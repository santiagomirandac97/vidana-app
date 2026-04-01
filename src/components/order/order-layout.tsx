'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

import { useUser, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import type { UserProfile, Company } from '@/lib/types';
import { CartProvider } from '@/context/cart-context';
import { OrderHeader } from './order-header';
import { BottomTabBar } from './bottom-tab-bar';

export function OrderLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isSignup = pathname === '/order/signup';
  const { user, isLoading: authLoading } = useUser();
  const { firestore } = useFirebase();

  // ALL hooks must be called unconditionally (React rules of hooks)
  const userProfileRef = useMemoFirebase(
    () => (!isSignup && firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [isSignup, firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companyDocRef = useMemoFirebase(
    () =>
      !isSignup && firestore && userProfile?.companyId
        ? doc(firestore, `companies/${userProfile.companyId}`)
        : null,
    [isSignup, firestore, userProfile?.companyId]
  );
  const { data: company } = useDoc<Company>(companyDocRef);

  // Auth guard — redirect non-customers to /selection
  useEffect(() => {
    if (isSignup || authLoading || profileLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (userProfile && userProfile.role !== 'customer') {
      router.replace('/selection');
    }
  }, [isSignup, authLoading, profileLoading, user, userProfile, router]);

  // Signup page is standalone — render children without the order shell
  if (isSignup) {
    return <>{children}</>;
  }

  // Loading state
  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#FAFAFA]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not authenticated or wrong role — render nothing while redirecting
  if (!user || (userProfile && userProfile.role !== 'customer')) {
    return null;
  }

  const companyName = (company as any)?.portalDisplayName ?? company?.name ?? '';

  return (
    <CartProvider>
      <div className="flex flex-col min-h-screen bg-background">
        <OrderHeader companyName={companyName} />

        {/* White content card */}
        <main className="flex flex-col flex-1 pb-20 md:pb-6 max-w-5xl mx-auto w-full px-3 md:px-4">
          <div className="flex flex-col flex-1 bg-white rounded-2xl shadow-xl overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex flex-col flex-1"
            >
              {children}
            </motion.div>
          </AnimatePresence>
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <BottomTabBar />
      </div>
    </CartProvider>
  );
}
