
'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc, useAuth } from '@/firebase';
import { collection, query, where, doc, updateDoc, orderBy } from 'firebase/firestore';
import { type Company, type Consumption, type UserProfile, type OrderItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, Home, ChefHat, Clock, AlertTriangle, Flame } from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn, formatTimestamp } from '@/lib/utils';
import { signOut } from 'firebase/auth';
import { ScrollArea } from '@/components/ui/scroll-area';

const KIOSK_COMPANY_ID = "Yzf6ucrafGkOPqbqCJpl"; // Noticieros Televisa Company ID

// Urgency thresholds in minutes
const URGENCY_WARNING_MINUTES = 10;
const URGENCY_DANGER_MINUTES = 15;

export default function CommandPage() {
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
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="ml-4 text-lg">Cargando Comanda...</p>
            </div>
        );
    }
    
    if (userProfile?.role !== 'admin') {
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

    return <CommandDashboard />;
}


const CommandDashboard: FC = () => {
    const { firestore } = useFirebase();
    const auth = useAuth();
    const router = useRouter();

    const companyDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'companies', KIOSK_COMPANY_ID) : null, [firestore]);
    const { data: company, isLoading: companyLoading } = useDoc<Company>(companyDocRef);

    const pendingOrdersQuery = useMemoFirebase(() => 
        firestore 
            ? query(
                collection(firestore, `companies/${KIOSK_COMPANY_ID}/consumptions`), 
                where('status', '==', 'pending'),
                orderBy('timestamp', 'asc')
              ) 
            : null
    , [firestore]);
    const { data: pendingOrders, isLoading: ordersLoading } = useCollection<Consumption>(pendingOrdersQuery);
    
    const { toast } = useToast();

    const handleSignOut = async () => {
        if (auth) {
            await signOut(auth);
            localStorage.removeItem('selectedCompanyId');
            router.push('/login');
        }
    };
    
    const handleMarkAsDone = async (orderId: string) => {
        if (!firestore) return;
        const orderDocRef = doc(firestore, `companies/${KIOSK_COMPANY_ID}/consumptions`, orderId);
        try {
            await updateDoc(orderDocRef, { status: 'completed' });
            toast({ title: 'Orden Completada', description: 'La orden ha sido marcada como completada.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar la orden.' });
        }
    }

    const isLoading = companyLoading || ordersLoading;

    return (
        <div className="bg-gray-100 dark:bg-gray-950 min-h-screen">
             <header className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-3">
                        <Logo />
                        <div className='text-center'>
                             <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <ChefHat /> Comanda de Cocina
                             </h1>
                             <p className='text-sm text-muted-foreground'>{company?.name || 'Cargando...'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <Button variant="outline" onClick={() => router.push('/selection')}>
                                <Home className="mr-2 h-4 w-4" />
                                Menú Principal
                            </Button>
                        </div>
                    </div>
                </div>
            </header>
             <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                {isLoading ? (
                    <div className="flex h-[70vh] w-full items-center justify-center">
                        <Loader2 className="h-10 w-10 animate-spin" />
                        <p className="ml-4 text-lg">Cargando órdenes pendientes...</p>
                    </div>
                ) : !pendingOrders || pendingOrders.length === 0 ? (
                     <div className="flex h-[70vh] w-full items-center justify-center">
                        <div className='text-center text-muted-foreground'>
                            <ChefHat className="h-16 w-16 mx-auto" />
                            <h2 className='text-2xl font-semibold mt-4'>Todo en orden</h2>
                            <p>No hay órdenes pendientes en este momento.</p>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="h-[85vh]">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
                            {pendingOrders.map(order => (
                                <OrderCard key={order.id} order={order} onMarkAsDone={handleMarkAsDone} />
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </main>
        </div>
    );
};


const OrderCard: FC<{ order: Consumption, onMarkAsDone: (orderId: string) => void }> = ({ order, onMarkAsDone }) => {
    return (
        <Card className="shadow-md hover:shadow-xl transition-shadow duration-300 border-2 border-gray-200 dark:border-gray-700">
            <CardHeader className="p-4 bg-gray-50 dark:bg-gray-800">
                <CardTitle className="text-lg flex justify-between items-center">
                    <span>{order.name}</span>
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                    <Clock className="h-4 w-4" /> 
                    Pedido a las: {formatTimestamp(order.timestamp)}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
                <ul className="space-y-2">
                    {order.items?.map(item => (
                        <li key={item.itemId} className="flex justify-between items-center text-sm">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-muted-foreground font-bold">x {item.quantity}</span>
                        </li>
                    ))}
                </ul>
                <Button className="w-full mt-4 bg-green-600 hover:bg-green-700" onClick={() => onMarkAsDone(order.id!)}>
                    Completada
                </Button>
            </CardContent>
        </Card>
    );
}
