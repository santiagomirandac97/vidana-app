
'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc, useAuth } from '@/firebase';
import { collection, query, where, doc, updateDoc, orderBy, Timestamp } from 'firebase/firestore';
import { type Company, type Consumption, type UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, Home, ChefHat, Clock, AlertTriangle, Flame, CheckCircle, Calendar as CalendarIcon, RotateCcw } from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn, formatTimestamp, getTodayInMexicoCity } from '@/lib/utils';
import { signOut } from 'firebase/auth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const KIOSK_COMPANY_ID = "Yzf6ucrafGkOPqbqCJpl"; // Noticieros Televisa Company ID

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
    const router = useRouter();

    const companyDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'companies', KIOSK_COMPANY_ID) : null, [firestore]);
    const { data: company, isLoading: companyLoading } = useDoc<Company>(companyDocRef);

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
                <Tabs defaultValue="pending">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="pending">Órdenes Pendientes</TabsTrigger>
                        <TabsTrigger value="completed">Órdenes Completadas</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending">
                        <PendingOrdersTab />
                    </TabsContent>
                    <TabsContent value="completed">
                        <CompletedOrdersTab />
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

const PendingOrdersTab: FC = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();

     const pendingOrdersQuery = useMemoFirebase(() => 
        firestore 
            ? query(
                collection(firestore, `companies/${KIOSK_COMPANY_ID}/consumptions`), 
                where('status', '==', 'pending')
              ) 
            : null
    , [firestore]);

    const { data: pendingOrders, isLoading: ordersLoading } = useCollection<Consumption>(pendingOrdersQuery);
    
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

    if (ordersLoading) {
        return (
            <div className="flex h-[70vh] w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="ml-4 text-lg">Cargando órdenes pendientes...</p>
            </div>
        );
    }
    
    return !pendingOrders || pendingOrders.length === 0 ? (
        <div className="flex h-[70vh] w-full items-center justify-center">
            <div className='text-center text-muted-foreground'>
                <ChefHat className="h-16 w-16 mx-auto" />
                <h2 className='text-2xl font-semibold mt-4'>Todo en orden</h2>
                <p>No hay órdenes pendientes en este momento.</p>
            </div>
        </div>
    ) : (
        <ScrollArea className="h-[80vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
                {pendingOrders.map(order => (
                    <OrderCard key={order.id} order={order} onMarkAsDone={handleMarkAsDone} />
                ))}
            </div>
        </ScrollArea>
    );
}

const CompletedOrdersTab: FC = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [recoveryCandidate, setRecoveryCandidate] = useState<Consumption | null>(null);

    const allCompletedOrdersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, `companies/${KIOSK_COMPANY_ID}/consumptions`),
            where('status', '==', 'completed')
        );
    }, [firestore]);
    
    const { data: allCompletedOrders, isLoading: ordersLoading } = useCollection<Consumption>(allCompletedOrdersQuery);

    const filteredAndSortedOrders = useMemo(() => {
        if (!allCompletedOrders) return [];
        
        const targetDate = formatDate(selectedDate, "yyyy-MM-dd");

        return allCompletedOrders
            .filter(order => {
                const orderDate = formatDate(new Date(order.timestamp), "yyyy-MM-dd");
                return orderDate === targetDate;
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    }, [allCompletedOrders, selectedDate]);
    
    const handleRecoverOrder = async () => {
        if (!firestore || !recoveryCandidate) return;
        const orderDocRef = doc(firestore, `companies/${KIOSK_COMPANY_ID}/consumptions`, recoveryCandidate.id!);
        try {
            await updateDoc(orderDocRef, { status: 'pending' });
            toast({ title: 'Orden Recuperada', description: `La orden de ${recoveryCandidate.name} ha vuelto a pendientes.` });
        } catch (error) {
             toast({ variant: 'destructive', title: 'Error', description: 'No se pudo recuperar la orden.' });
        } finally {
            setRecoveryCandidate(null);
        }
    }

    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                <h3 className="text-lg font-medium">Ver completadas del día:</h3>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "w-[280px] justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? formatDate(selectedDate, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(date)}
                            initialFocus
                            locale={es}
                        />
                    </PopoverContent>
                </Popover>
            </div>

            {ordersLoading ? (
                <div className="flex h-[60vh] w-full items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin" />
                    <p className="ml-4 text-lg">Cargando órdenes completadas...</p>
                </div>
            ) : filteredAndSortedOrders.length === 0 ? (
                <div className="flex h-[60vh] w-full items-center justify-center">
                    <div className='text-center text-muted-foreground'>
                        <CheckCircle className="h-16 w-16 mx-auto" />
                        <h2 className='text-2xl font-semibold mt-4'>Sin Órdenes</h2>
                        <p>No se encontraron órdenes completadas para la fecha seleccionada.</p>
                    </div>
                </div>
            ) : (
                 <ScrollArea className="h-[70vh]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
                        {filteredAndSortedOrders.map(order => (
                            <CompletedOrderCard key={order.id} order={order} onRecoverRequest={() => setRecoveryCandidate(order)} />
                        ))}
                    </div>
                </ScrollArea>
            )}
            
            <AlertDialog open={!!recoveryCandidate} onOpenChange={(isOpen) => !isOpen && setRecoveryCandidate(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción devolverá la orden de <span className="font-bold">{recoveryCandidate?.name}</span> a la lista de pendientes.
                            Solo se recomienda para corregir errores.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRecoverOrder}>Recuperar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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

const CompletedOrderCard: FC<{ order: Consumption, onRecoverRequest: () => void }> = ({ order, onRecoverRequest }) => {
    const isToday = useMemo(() => {
        const todayString = getTodayInMexicoCity();
        const orderDateString = formatDate(new Date(order.timestamp), 'yyyy-MM-dd');
        return todayString === orderDateString;
    }, [order.timestamp]);
    
    return (
        <Card className="shadow-sm border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
            <CardHeader className="p-4">
                <CardTitle className="text-base flex justify-between items-center">
                    <span>{order.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">#{order.employeeNumber}</span>
                </CardTitle>
                <CardDescription className="flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3" /> 
                    Completada: {formatTimestamp(order.timestamp)}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <ul className="space-y-1 text-xs">
                    {order.items?.map(item => (
                        <li key={item.itemId} className="flex justify-between items-center">
                            <span>{item.name}</span>
                            <span className="text-muted-foreground font-medium">x {item.quantity}</span>
                        </li>
                    ))}
                </ul>
                 <div className="border-t mt-2 pt-2 flex justify-between items-center font-bold text-sm">
                    <span>Total:</span>
                    <span>${order.totalAmount?.toFixed(2) ?? '0.00'}</span>
                </div>
                 {isToday && (
                    <Button variant="outline" size="sm" className="w-full mt-3" onClick={onRecoverRequest}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Recuperar
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
