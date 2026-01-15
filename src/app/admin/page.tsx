'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, getDocs, doc, where, Timestamp, collectionGroup } from 'firebase/firestore';
import { type Company, type Consumption, type UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime, toDate, formatInTimeZone } from 'date-fns-tz';
import { getTodayInMexicoCity } from '@/lib/utils';
import { DollarSign, Users, BarChart, LogOut, Loader2, CalendarDays, ShieldAlert, Home, TrendingUp, Utensils } from 'lucide-react';
import { Logo } from '@/components/logo';

export default function AdminDashboardPage() {
    const { user, isLoading: userLoading } = useUser();
    const router = useRouter();
    const { firestore } = useFirebase();
    const timeZone = 'America/Mexico_City';

    const userProfileRef = useMemoFirebase(() => 
        firestore && user ? doc(firestore, `users/${user.uid}`) : null
    , [firestore, user]);
    const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

    const companiesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'companies')) : null
    , [firestore]);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

    const monthlyConsumptionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        const nowInMexicoCity = toZonedTime(new Date(), timeZone);
        const startOfCurrentMonth = startOfMonth(nowInMexicoCity);
        return query(
            collectionGroup(firestore, 'consumptions'),
            where('timestamp', '>=', startOfCurrentMonth.toISOString())
        );
    }, [firestore, timeZone]);

    const { data: allConsumptions, isLoading: consumptionsLoading } = useCollection<Consumption>(monthlyConsumptionsQuery);
    
    useEffect(() => {
        if (!userLoading && !user) {
            router.push('/login');
        }
    }, [user, userLoading, router]);

    const pageIsLoading = userLoading || profileLoading || companiesLoading || consumptionsLoading;

    const statsByCompany = useMemo(() => {
        if (pageIsLoading || !companies || companies.length === 0 || !allConsumptions) return [];
        
        const nowInMexicoCity = toZonedTime(new Date(), timeZone);
        const todayMexico = formatInTimeZone(nowInMexicoCity, timeZone, 'yyyy-MM-dd');
        
        return companies.map(company => {
            const companyName = company.name || 'Empresa sin nombre';
            const companyConsumptions = allConsumptions.filter(c => c.companyId === company.id && !c.voided && c.employeeId !== 'anonymous');
            
            const todayConsumptions = companyConsumptions.filter(c => formatInTimeZone(new Date(c.timestamp), timeZone, 'yyyy-MM-dd') === todayMexico);
            
            const monthlyConsumptions = companyConsumptions;
            
            const mealPrice = company.mealPrice || 0;
            const dailyTarget = company.dailyTarget || 0;

            let dailyRevenue = todayConsumptions.length * mealPrice;
            let monthlyRevenue = 0;
            
            if (dailyTarget > 0) {
                const todayDate = toZonedTime(new Date(), timeZone);
                const dayOfWeek = getDay(todayDate);
                const isChargeableDay = dayOfWeek >= 1 && dayOfWeek <= 4; // Monday to Thursday

                if (isChargeableDay) {
                    dailyRevenue = Math.max(todayConsumptions.length, dailyTarget) * mealPrice;
                }
                
                const startOfMonthDate = startOfMonth(nowInMexicoCity);
                const daysInMonthSoFar = eachDayOfInterval({ start: startOfMonthDate, end: nowInMexicoCity });
                
                const monthlyConsumptionsByDay: { [key: string]: number } = {};
                monthlyConsumptions.forEach(c => {
                    const day = formatInTimeZone(new Date(c.timestamp), timeZone, 'yyyy-MM-dd');
                    monthlyConsumptionsByDay[day] = (monthlyConsumptionsByDay[day] || 0) + 1;
                });

                monthlyRevenue = daysInMonthSoFar.reduce((total, date) => {
                    const dayStr = format(date, 'yyyy-MM-dd');
                    const dayOfWeek = getDay(date);
                    const isChargeableDay = dayOfWeek >= 1 && dayOfWeek <= 4;
                    const countForDay = monthlyConsumptionsByDay[dayStr] || 0;

                    if (isChargeableDay) {
                        return total + (Math.max(countForDay, dailyTarget) * mealPrice);
                    } else {
                        return total + (countForDay * mealPrice);
                    }
                }, 0);

            } else {
                 monthlyRevenue = monthlyConsumptions.length * mealPrice;
            }

            return {
                ...company,
                name: companyName,
                consumptions: companyConsumptions,
                todayCount: todayConsumptions.length,
                dailyRevenue,
                monthlyCount: monthlyConsumptions.length,
                monthlyRevenue,
                mealPrice,
                dailyTarget,
            };
        });
    }, [companies, allConsumptions, pageIsLoading, timeZone]);

    const totalStats = useMemo(() => {
        if (pageIsLoading || !statsByCompany || statsByCompany.length === 0) return { monthlyRevenue: 0, monthlyCount: 0, todayCount: 0, dailyRevenue: 0 };
        return statsByCompany.reduce((acc, company) => {
            acc.monthlyRevenue += company.monthlyRevenue;
            acc.monthlyCount += company.monthlyCount;
            acc.todayCount += company.todayCount;
            acc.dailyRevenue += company.dailyRevenue;
            return acc;
        }, { monthlyRevenue: 0, monthlyCount: 0, todayCount: 0, dailyRevenue: 0 });
    }, [statsByCompany, pageIsLoading]);

    // We filter all consumptions to only include employee-specific ones for the total chart
    const employeeOnlyConsumptions = useMemo(() => allConsumptions?.filter(c => c.employeeId !== 'anonymous' && !c.voided) || [], [allConsumptions]);


    if (pageIsLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="ml-4 text-lg">Cargando datos del administrador...</p>
            </div>
        );
    }
    
    if (!user || userProfile?.role !== 'admin') {
         return (
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
        );
    }

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
            <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <Logo />
                        <Button variant="outline" onClick={() => router.push('/selection')}>
                            <Home className="mr-2 h-4 w-4" />
                            Volver al menú
                        </Button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <TotalStatsCard totalStats={totalStats} allConsumptions={employeeOnlyConsumptions} isLoading={pageIsLoading} />
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                    {statsByCompany.map(companyStats => (
                        <CompanyStatCard key={companyStats.id} companyStats={companyStats} />
                    ))}
                 </div>
            </main>
        </div>
    );
};


const TotalStatsCard: FC<{ totalStats: any, allConsumptions: Consumption[], isLoading: boolean }> = ({ totalStats, allConsumptions, isLoading }) => {
    if (isLoading) {
        return (
            <Card className="shadow-lg col-span-1 sm:col-span-2 lg:col-span-3">
                <CardHeader>
                    <CardTitle className="flex justify-between items-start text-2xl">
                        <span>Ventas Totales de Comedor del Periodo</span>
                        <TrendingUp className="h-7 w-7 text-gray-400" />
                    </CardTitle>
                    <CardDescription>Resumen consolidado de todas las empresas (excluye ventas de POS).</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-64">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }
    
    return (
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 col-span-1 sm:col-span-2 lg:col-span-3">
            <CardHeader>
                <CardTitle className="flex justify-between items-start text-2xl">
                    <span>Ventas Totales de Comedor del Periodo</span>
                    <TrendingUp className="h-7 w-7 text-gray-400" />
                </CardTitle>
                <CardDescription>Resumen consolidado de todas las empresas (excluye ventas de POS).</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                         <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><Users className="h-4 w-4"/> Consumos Hoy</p>
                            <p className="text-2xl font-bold">{totalStats.todayCount}</p>
                        </div>
                        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4"/> Ingresos Hoy</p>
                            <p className="text-2xl font-bold">${totalStats.dailyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><CalendarDays className="h-4 w-4"/> Comidas Mes</p>
                            <p className="text-2xl font-bold">{totalStats.monthlyCount}</p>
                        </div>
                        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4"/> Ingresos Mes</p>
                            <p className="text-2xl font-bold">${totalStats.monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </div>
                 <div className="md:col-span-2 space-y-2">
                     <h4 className="font-semibold text-sm">Tendencia de Consumo Total de Comedor</h4>
                     <div className="h-56">
                        <MiniConsumptionChart 
                            consumptions={allConsumptions}
                            dailyTarget={0}
                        />
                     </div>
                </div>
            </CardContent>
        </Card>
    )
}


interface CompanyStatCardProps {
    companyStats: Company & {
        consumptions: Consumption[];
        todayCount: number;
        dailyRevenue: number;
        monthlyCount: number;
        monthlyRevenue: number;
        mealPrice: number;
        dailyTarget: number;
    };
}

const CompanyStatCard: FC<CompanyStatCardProps> = ({ companyStats }) => {
    return (
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
                <CardTitle className="flex justify-between items-start">
                    <span>{companyStats.name}</span>
                     <span className="text-sm font-normal px-2 py-1 bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-200">
                        ${companyStats.mealPrice}/comida
                    </span>
                </CardTitle>
                <CardDescription>Resumen del día y tendencias (solo comedor)</CardDescription>
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

                {companyStats.billingNote && (
                    <p className="text-xs text-center text-muted-foreground italic">
                        {companyStats.billingNote}
                    </p>
                )}
                
                <div className="space-y-2">
                     <h4 className="font-semibold text-sm">Tendencia de Consumo de Comedor</h4>
                     <MiniConsumptionChart 
                        consumptions={companyStats.consumptions}
                        dailyTarget={companyStats.dailyTarget}
                      />
                </div>
            </CardContent>
        </Card>
    )
}

const MiniConsumptionChart: FC<{ consumptions: Consumption[], dailyTarget: number }> = ({ consumptions, dailyTarget }) => {
    const timeZone = 'America/Mexico_City';
    const chartData = useMemo(() => {
        const dailyConsumptions: { [key: string]: { total: number; missing: number } } = {};
        
        consumptions.forEach(c => {
            if (!c.voided) {
                const day = formatInTimeZone(new Date(c.timestamp), timeZone, 'yyyy-MM-dd');
                if (!dailyConsumptions[day]) {
                    dailyConsumptions[day] = { total: 0, missing: 0 };
                }
                dailyConsumptions[day].total++;
            }
        });
        
        const hasTarget = dailyTarget > 0;
        if (hasTarget) {
            Object.keys(dailyConsumptions).forEach(day => {
                const date = toDate(day, { timeZone });
                const dayOfWeek = getDay(date); // 0=Sun, 1=Mon...
                const isChargeableDay = dayOfWeek >= 1 && dayOfWeek <= 4;
                
                if (isChargeableDay) {
                    const count = dailyConsumptions[day].total;
                    dailyConsumptions[day].missing = Math.max(0, dailyTarget - count);
                } else {
                    dailyConsumptions[day].missing = 0;
                }
            });
        }

        const sortedDays = Object.keys(dailyConsumptions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        const last7Days = sortedDays.slice(0, 7).reverse();

        return last7Days.map(day => ({
            name: format(toDate(day, { timeZone }), 'MMM dd', { locale: es }),
            total: dailyConsumptions[day].total,
            missing: dailyConsumptions[day].missing,
        }));
    }, [consumptions, dailyTarget, timeZone]);

    if (chartData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 border rounded-md bg-gray-50 dark:bg-gray-800">
                <BarChart className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground text-sm mt-2">No hay suficientes datos.</p>
            </div>
        );
    }
    
    const showMissing = dailyTarget > 0;

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
                        formatter={(value, name) => {
                            if (name === 'total') return [value, 'Registrados'];
                            if (name === 'missing') return [value, 'Faltantes para Objetivo'];
                            return [value, name];
                        }}
                    />
                    <Bar dataKey="total" stackId="a" fill="hsl(var(--primary))" name="Consumos" radius={showMissing ? [0,0,0,0] : [4, 4, 0, 0]} />
                    {showMissing && (
                        <Bar dataKey="missing" stackId="a" fill="hsl(var(--primary) / 0.3)" name="Faltantes para Objetivo" radius={[4, 4, 0, 0]} />
                    )}
                </RechartsBarChart>
            </ResponsiveContainer>
        </div>
    );
};
