'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

import { useUser, useFirebase, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import type { UserProfile, Company, Consumption } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// ─── Skeleton ───────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      {/* User info card */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-3">
        <Skeleton className="w-20 h-20 rounded-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-4 w-32" />
      </div>
      {/* Stats card */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <Skeleton className="h-5 w-36" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
      {/* Logout button */}
      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useUser();
  const { firestore, auth } = useFirebase();

  // 1. Fetch user profile
  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companyId = userProfile?.companyId;

  // 2. Fetch company
  const companyDocRef = useMemoFirebase(
    () => (firestore && companyId ? doc(firestore, `companies/${companyId}`) : null),
    [firestore, companyId]
  );
  const { data: company, isLoading: companyLoading } = useDoc<Company>(companyDocRef);

  // 3. Fetch all portal consumptions for this user
  const consumptionsQuery = useMemoFirebase(
    () =>
      firestore && companyId && user
        ? query(
            collection(firestore, `companies/${companyId}/consumptions`),
            where('employeeId', '==', user.uid),
            where('source', '==', 'portal')
          )
        : null,
    [firestore, companyId, user]
  );
  const { data: consumptions, isLoading: consumptionsLoading } =
    useCollection<Consumption>(consumptionsQuery);

  // 4. Compute stats
  const monthStart = useMemo(() => getMonthStart(), []);

  const totalOrders = consumptions?.length ?? 0;

  const monthOrders = useMemo(() => {
    if (!consumptions) return 0;
    return consumptions.filter((c) => c.timestamp >= monthStart).length;
  }, [consumptions, monthStart]);

  const isLoading = profileLoading || companyLoading || consumptionsLoading;

  // Logout handler
  const handleLogout = async () => {
    document.cookie = 'vidana_session=; path=/; max-age=0';
    await signOut(auth);
    router.replace('/login');
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const initials = userProfile?.name ? getInitials(userProfile.name) : '?';

  return (
    <div className="space-y-4">
      {/* User info card */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-1">
        <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold shadow-md">
          {initials}
        </div>
        <h1 className="text-xl font-bold mt-3">{userProfile?.name}</h1>
        <p className="text-muted-foreground text-sm">{userProfile?.email}</p>
        {company?.name && (
          <p className="text-sm text-muted-foreground mt-0.5">{company.name}</p>
        )}
      </div>

      {/* Order stats card */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Mis estad{'\u00ED'}sticas</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold font-mono">{monthOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">{'\u00D3'}rdenes este mes</p>
          </div>
          <div className="bg-muted/30 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold font-mono">{totalOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">Total de {'\u00F3'}rdenes</p>
          </div>
        </div>
      </div>

      {/* Logout button */}
      <Button
        variant="outline"
        className="w-full rounded-full border-destructive text-destructive hover:bg-destructive/5 hover:text-destructive"
        onClick={handleLogout}
      >
        Cerrar sesi{'\u00F3'}n
      </Button>
    </div>
  );
}
