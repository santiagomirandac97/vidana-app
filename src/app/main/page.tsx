'use client';

import { useState, useEffect, useMemo } from 'react';
import { Building, ChevronDown, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startOfMonth } from 'date-fns';
import { useFirebase, useCollection, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { toZonedTime } from 'date-fns-tz';

import { type Company, type Employee, type Consumption, type UserProfile } from '@/lib/types';
import { getTodayInMexicoCity } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AppShell, PageHeader } from '@/components/layout';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { EmployeeSearch } from './components/EmployeeSearch';
import { ConsumptionHistory } from './components/ConsumptionHistory';

export default function MainPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const timeZone = 'America/Mexico_City';

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const allCompaniesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null),
    [firestore]
  );
  const { data: allCompanies, isLoading: companiesLoading } = useCollection<Company>(allCompaniesQuery);

  const companyDocRef = useMemoFirebase(
    () => (firestore && selectedCompanyId ? doc(firestore, `companies/${selectedCompanyId}`) : null),
    [firestore, selectedCompanyId]
  );
  const { data: company } = useDoc<Company>(companyDocRef);

  const employeesQuery = useMemoFirebase(
    () =>
      firestore && selectedCompanyId
        ? query(collection(firestore, `companies/${selectedCompanyId}/employees`))
        : null,
    [firestore, selectedCompanyId]
  );
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const startOfCurrentMonth = useMemo(() => {
    const nowInMexicoCity = toZonedTime(new Date(), timeZone);
    return startOfMonth(nowInMexicoCity);
  }, [timeZone]);

  const todaysConsumptionsQuery = useMemoFirebase(() => {
    if (!firestore || !selectedCompanyId) return null;
    const todayMexico = getTodayInMexicoCity();
    const startOfDay = new Date(todayMexico + 'T00:00:00');
    const endOfDay = new Date(todayMexico + 'T23:59:59');
    return query(
      collection(firestore, `companies/${selectedCompanyId}/consumptions`),
      where('timestamp', '>=', startOfDay.toISOString()),
      where('timestamp', '<=', endOfDay.toISOString())
    );
  }, [firestore, selectedCompanyId]);
  const { data: todaysConsumptions } = useCollection<Consumption>(todaysConsumptionsQuery);

  const monthlyConsumptionsQuery = useMemoFirebase(
    () =>
      firestore && selectedCompanyId
        ? query(
            collection(firestore, `companies/${selectedCompanyId}/consumptions`),
            where('timestamp', '>=', startOfCurrentMonth.toISOString()),
            orderBy('timestamp', 'desc')
          )
        : null,
    [firestore, selectedCompanyId, startOfCurrentMonth]
  );
  const { data: monthlyConsumptions } = useCollection<Consumption>(monthlyConsumptionsQuery);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    if (!selectedCompanyId && allCompanies && allCompanies.length > 0) {
      const storedCompanyId = localStorage.getItem('selectedCompanyId');
      if (storedCompanyId && allCompanies.some((c) => c.id === storedCompanyId)) {
        setSelectedCompanyId(storedCompanyId);
      } else {
        setSelectedCompanyId(allCompanies[0].id);
      }
    }
  }, [allCompanies, selectedCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) {
      localStorage.setItem('selectedCompanyId', selectedCompanyId);
    }
  }, [selectedCompanyId]);

  if (userLoading || !user || companiesLoading || profileLoading || !selectedCompanyId || !company || !allCompanies) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-3 text-lg">Cargando datos de la empresa...</p>
      </div>
    );
  }

  const companySelector = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-44 justify-start h-8 text-sm border-border/60">
          <Building className="mr-2 h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{company?.name}</span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44">
        {allCompanies.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => setSelectedCompanyId(c.id)}>
            {c.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AppShell>
      <main className="container mx-auto p-4 sm:p-6 md:p-8">
        <PageHeader title="Registros" subtitle={company?.name ?? ''} action={companySelector} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <EmployeeSearch companyId={selectedCompanyId} company={company} />
          </div>

          <div className="lg:col-span-1 space-y-8">
            <ConsumptionHistory
              companyId={selectedCompanyId}
              company={company}
              employees={employees || []}
              todaysConsumptions={todaysConsumptions || []}
              monthlyConsumptions={monthlyConsumptions || []}
            />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
