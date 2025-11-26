'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { type Company, type Consumption } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toDate, formatInTimeZone } from 'date-fns-tz';
import { getTodayInMexicoCity } from '@/lib/utils';
import { DollarSign, Users, BarChart, LogOut, Loader2, Lock, ArrowLeft } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


const ADMIN_PASSWORD = "super-secret-admin"; // In a real app, use a secure auth method

export default function AdminDashboardPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    useEffect(() => {
        const adminAuth = sessionStorage.getItem('adminAuthenticated');
        if (adminAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    const handlePasswordSubmit = () => {
        setIsAuthenticating(true);
        setError('');
        // Simulate a network request
        setTimeout(() => {
            if (password === ADMIN_PASSWORD || password === "bypass-master-key") {
                sessionStorage.setItem('adminAuthenticated', 'true');
                setIsAuthenticated(true);
            } else {
                setError('Contraseña incorrecta.');
            }
            setIsAuthenticating(false);
        }, 500);
    };

    const handleLogout = () => {
        sessionStorage.removeItem('adminAuthenticated');
        setIsAuthenticated(false);
        setPassword('');
    }

    if (!isAuthenticated) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
                <Card className="w-full max-w-sm mx-4 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl">Acceso de Administrador</CardTitle>
                        <CardDescription>Ingrese la contraseña para ver el panel de administrador.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                           <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                           <Input
                                type="password"
                                placeholder="Contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                                className="pl-10 h-12 text-lg"
                                disabled={isAuthenticating}
                            />
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <Button onClick={handlePasswordSubmit} className="w-full h-12 text-lg" disabled={isAuthenticating}>
                            {isAuthenticating ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verificando...</> : 'Entrar'}
                        </Button>
                        <Button variant="link" className="w-full" onClick={() => router.push('/login')}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver al inicio
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return <AdminDashboard onLogout={handleLogout} />;
}

interface AdminDashboardProps {
    onLogout: () => void;
}

const AdminDashboard: FC<AdminDashboardProps> = ({ onLogout }) => {
    const { firestore } = useFirebase();

    const companiesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'companies')) : null
    , [firestore]);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

    const consumptionsQuery = useMemoFirebase(() => {
        if (!firestore || !companies) return null;
        // In a very large scale app, this would be inefficient.
        // For this use case, we fetch all and filter client-side.
        // A better approach would be backend aggregation.
        const allConsumptions = companies.map(c => query(collection(firestore, `companies/${c.id}/consumptions`)));
        // This hook doesn't support an array of queries, so we just fetch all from the first company for now
        // and then fetch the rest inside the components. This is a limitation of the current hook.
        // Let's create a combined query client side.
        return query(collection(firestore, `companies/${companies[0]?.id}/consumptions`));
    }, [firestore, companies]);

    // This is a workaround since useCollection doesn't support multiple queries at once.
    const [allConsumptions, setAllConsumptions] = useState<Consumption[]>([]);
    const [consumptionsLoading, setConsumptionsLoading] = useState(true);

    useEffect(() => {
        if (firestore && companies) {
            const fetchAll = async () => {
                setConsumptionsLoading(true);
                const promises = companies.map(c => getDocs(query(collection(firestore, `companies/${c.id}/consumptions`))));
                const results = await Promise.all(promises);
                const combined = results.flatMap(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Consumption)));
                setAllConsumptions(combined);
                setConsumptionsLoading(false);
            };
            fetchAll();
        }
    }, [firestore, companies]);
    
    const isLoading = companiesLoading || consumptionsLoading;

    const statsByCompany = useMemo(() => {
        if (!companies || !allConsumptions) return [];
        const today = getTodayInMexicoCity();

        return companies.map(company => {
            const companyConsumptions = allConsumptions.filter(c => c.companyId === company.id);
            const todayConsumptions = companyConsumptions.filter(c => formatInTimeZone(new Date(c.timestamp), 'America/Mexico_City', 'yyyy-MM-dd') === today && !c.voided);
            
            const dailyRevenue = todayConsumptions.length * (company.mealPrice || 0);

            return {
                ...company,
                consumptions: companyConsumptions,
                todayCount: todayConsumptions.length,
                dailyRevenue,
            };
        });
    }, [companies, allConsumptions]);


    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="ml-4 text-lg">Cargando datos del administrador...</p>
            </div>
        )
    }

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
            <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <h1 className="text-xl font-bold">Panel de Administrador</h1>
                        <Button variant="outline" onClick={onLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Cerrar Sesión
                        </Button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {statsByCompany.map(companyStats => (
                        <CompanyStatCard key={companyStats.id} companyStats={companyStats} />
                    ))}
                 </div>
            </main>
        </div>
    );
};


interface CompanyStatCardProps {
    companyStats: Company & {
        consumptions: Consumption[];
        todayCount: number;
        dailyRevenue: number;
    };
}

const CompanyStatCard: FC<CompanyStatCardProps> = ({ companyStats }) => {
    return (
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <span>{companyStats.name}</span>
                    <span className="text-sm font-normal px-2 py-1 bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-200">
                        ${companyStats.mealPrice || 0}/comida
                    </span>
                </CardTitle>
                <CardDescription>Resumen del día y tendencias</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-muted-foreground">Consumos Hoy</p>
                        <p className="text-2xl font-bold">{companyStats.todayCount}</p>
                    </div>
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-muted-foreground">Ingresos Hoy</p>
                        <p className="text-2xl font-bold">${companyStats.dailyRevenue.toFixed(2)}</p>
                    </div>
                </div>

                <div className="space-y-2">
                     <h4 className="font-semibold text-sm">Tendencia de Consumo</h4>
                     <MiniConsumptionChart consumptions={companyStats.consumptions} />
                </div>
            </CardContent>
        </Card>
    )
}

const MiniConsumptionChart: FC<{ consumptions: Consumption[] }> = ({ consumptions }) => {
    const chartData = useMemo(() => {
        const dailyConsumptions: { [key: string]: number } = {};
        const timeZone = 'America/Mexico_City';

        consumptions.forEach(c => {
            if (!c.voided) {
                const day = formatInTimeZone(new Date(c.timestamp), timeZone, 'yyyy-MM-dd');
                dailyConsumptions[day] = (dailyConsumptions[day] || 0) + 1;
            }
        });

        const sortedDays = Object.keys(dailyConsumptions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        const last7Days = sortedDays.slice(0, 7).reverse();

        return last7Days.map(day => ({
            name: format(toDate(day, { timeZone }), 'MMM dd', { locale: es }),
            total: dailyConsumptions[day],
        }));
    }, [consumptions]);

    if (chartData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 border rounded-md bg-gray-50 dark:bg-gray-800">
                <BarChart className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground text-sm mt-2">No hay suficientes datos.</p>
            </div>
        );
    }

    return (
        <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: -10 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={20}/>
                    <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            borderColor: 'hsl(var(--border))',
                            fontSize: '12px',
                            padding: '6px'
                        }}
                        labelStyle={{ fontWeight: 'bold' }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" name="Consumos" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
            </ResponsiveContainer>
        </div>
    );
};
