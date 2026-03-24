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
      router.replace('/order/signup');
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

  const companyName = company?.name ?? '';

  return (
    <CartProvider>
      <div className="flex flex-col min-h-screen bg-[#FAFAFA]">
        <OrderHeader companyName={companyName} />

        {/* Main content area */}
        <main className="flex-1 px-4 pt-4 pb-28 md:pb-6 max-w-5xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile bottom tab bar */}
        <BottomTabBar />
      </div>
    </CartProvider>
  );
}
