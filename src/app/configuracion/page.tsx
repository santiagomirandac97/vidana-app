'use client';

import { useState, useEffect, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import { type Company, type UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AppShell, PageHeader } from '@/components/layout';
import { Loader2, ShieldAlert, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmpresasTab } from './components/EmpresasTab';
import { MenuTab } from './components/MenuTab';
import { UsuariosTab } from './components/UsuariosTab';

const TABS = [
    { value: 'companies', label: 'Gestionar Empresas' },
    { value: 'menus', label: 'Gestionar Menús' },
    { value: 'users', label: 'Gestionar Usuarios' },
];

export default function ConfiguracionPage() {
    const { user, isLoading: userLoading } = useUser();
    const router = useRouter();
    const { firestore } = useFirebase();

    const userProfileRef = useMemoFirebase(() =>
        firestore && user ? doc(firestore, `users/${user.uid}`) : null
    , [firestore, user]);
    const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

    const isLoading = userLoading || profileLoading;

    useEffect(() => {
        if (!isLoading && !user) {
            router.replace('/login');
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <AppShell>
                <div className="flex h-screen w-full items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin" />
                    <p className="ml-4 text-lg">Verificando acceso de administrador...</p>
                </div>
            </AppShell>
        );
    }

    if (userProfile?.role !== 'admin') {
         return (
            <AppShell>
                <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
                    <Card className="w-full max-w-sm mx-4 shadow-xl text-center">
                        <CardHeader>
                            <CardTitle className="flex flex-col items-center gap-2">
                                <ShieldAlert className="h-12 w-12 text-destructive" />
                                Acceso Denegado
                            </CardTitle>
                            <CardDescription>No tiene los permisos necesarios para ver esta página.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.push('/selection')} className="w-full">
                                <Home className="mr-2 h-4 w-4" />
                                Volver al Inicio
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <ConfiguracionDashboard />
        </AppShell>
    );
}

const ConfiguracionDashboard: FC = () => {
    const { firestore } = useFirebase();
    const [activeTab, setActiveTab] = useState('companies');

    const companiesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null
    , [firestore]);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            <PageHeader title="Configuración" subtitle="Empresas, menús y usuarios" />
            <div className="flex gap-8">
                {/* Vertical nav list */}
                <div className="w-44 shrink-0">
                    <nav className="space-y-1">
                        {TABS.map(tab => (
                            <button
                                key={tab.value}
                                onClick={() => setActiveTab(tab.value)}
                                className={cn(
                                    'w-full text-left px-3 py-2 text-sm rounded-md transition-colors border-l-2',
                                    activeTab === tab.value
                                        ? 'bg-primary/5 text-primary font-medium border-primary pl-[10px]'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground border-transparent pl-[10px]'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
                {/* Content area */}
                <div className="flex-1 min-w-0">
                    <div className={activeTab === 'companies' ? 'block' : 'hidden'}>
                        <EmpresasTab companies={companies} companiesLoading={companiesLoading} />
                    </div>
                    <div className={activeTab === 'menus' ? 'block' : 'hidden'}>
                        <MenuTab companies={companies} companiesLoading={companiesLoading} />
                    </div>
                    <div className={activeTab === 'users' ? 'block' : 'hidden'}>
                        <UsuariosTab />
                    </div>
                </div>
            </div>
        </div>
    );
};
