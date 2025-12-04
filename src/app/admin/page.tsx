
'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { type Company, type Consumption } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toDate, formatInTimeZone } from 'date-fns-tz';
import { getTodayInMexicoCity } from '@/lib/utils';
import { DollarSign, Users, BarChart, LogOut, Loader2, Lock, ArrowLeft, CalendarDays } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Logo } from '@/components/logo';


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
            if (password === ADMIN_PASSWORD) {
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

    const [allConsumptions, setAllConsumptions] = useState<Consumption[]>([]);
    const [consumptionsLoading, setConsumptionsLoading] = useState(true);

    useEffect(() => {
        if (!firestore || companiesLoading) {
            return;
        }

        const fetchAll = async () => {
            setConsumptionsLoading(true);
            if (companies && companies.length > 0) {
                const promises = companies.map(c => getDocs(query(collection(firestore, `companies/${c.id}/consumptions`))));
                const results = await Promise.all(promises);
                const combined = results.flatMap(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Consumption)));
                setAllConsumptions(combined);
            } else {
                setAllConsumptions([]);
            }
            setConsumptionsLoading(false);
        };
        fetchAll();
    }, [firestore, companies, companiesLoading]);
    
    const isLoading = companiesLoading || consumptionsLoading;

    const statsByCompany = useMemo(() => {
        if (isLoading || !companies) return [];
        const today = getTodayInMexicoCity();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return companies.map(company => {
            const companyConsumptions = allConsumptions.filter(c => c.companyId === company.id && !c.voided);
            
            const todayConsumptions = companyConsumptions.filter(c => formatInTimeZone(new Date(c.timestamp), 'America/Mexico_City', 'yyyy-MM-dd') === today);
            
            const monthlyConsumptions = companyConsumptions.filter(c => {
                const consumptionDate = new Date(c.timestamp);
                return consumptionDate.getMonth() === currentMonth && consumptionDate.getFullYear() === currentYear;
            });
            
            let mealPrice = company.mealPrice || 0;
            if (mealPrice === 0) {
              if (company.name.toLowerCase().includes('inditex')) {
                mealPrice = 115;
              } else if (company.name.toLowerCase().includes('axo')) {
                mealPrice = 160;
              }
            }
            
            const dailyRevenue = todayConsumptions.length * mealPrice;
            const monthlyRevenue = monthlyConsumptions.length * mealPrice;

            return {
                ...company,
                consumptions: companyConsumptions,
                todayCount: todayConsumptions.length,
                dailyRevenue,
                monthlyCount: monthlyConsumptions.length,
                monthlyRevenue,
                mealPrice,
            };
        });
    }, [companies, allConsumptions, isLoading]);


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
                        <Logo />
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
        monthlyCount: number;
        monthlyRevenue: number;
        mealPrice: number;
    };
}

const CompanyStatCard: FC<CompanyStatCardProps> = ({ companyStats }) => {
    const currentMonth = new Date().getMonth(); // 0-11 (Jan-Dec)

    return (
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
                <CardTitle className="flex justify-between items-start">
                    <span>{companyStats.name}</span>
                     <span className="text-sm font-normal px-2 py-1 bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-200">
                        ${companyStats.mealPrice}/comida
                    </span>
                </CardTitle>
                <CardDescription>Resumen del día y tendencias</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><Users className="h-4 w-4"/> Consumos Hoy</p>
                        <p className="text-2xl font-bold">{companyStats.todayCount}</p>
                    </div>
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4"/> Ingresos Hoy</p>
                        <p className="text-2xl font-bold">${companyStats.dailyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><CalendarDays className="h-4 w-4"/> Comidas Mes</p>
                        <p className="text-2xl font-bold">{companyStats.monthlyCount}</p>
                    </div>
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4"/> Ingresos Mes</p>
                        <p className="text-2xl font-bold">${companyStats.monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>

                {companyStats.name.toLowerCase().includes('inditex') && (
                    <p className="text-xs text-center text-muted-foreground italic">
                        Solo se contabilizan comidas por nómina
                    </p>
                )}
                
                {companyStats.name.toLowerCase().includes('axo') && currentMonth === 10 && ( // 10 is November
                    <p className="text-xs text-center text-muted-foreground italic">
                        No se tiene registro completo de Noviembre
                    </p>
                )}


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

    