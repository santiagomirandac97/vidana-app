
'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, getDocs, orderBy } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { type Company, type UserProfile, type MenuItem, type OrderItem, type Consumption } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, Home, Utensils, PlusCircle, ShoppingCart, Trash2, CheckCircle } from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Hardcoded Company ID for Inditex
const INDITEX_COMPANY_ID = "E7Fz3iAbaH314m59t7qR";

export default function PosInditexPage() {
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
                <p className="ml-4 text-lg">Cargando POS...</p>
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

    return <PosDashboard />;
}


const PosDashboard: FC = () => {
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    const [inditexCompany, setInditexCompany] = useState<Company | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [order, setOrder] = useState<OrderItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!firestore) return;
        const fetchPosData = async () => {
            setIsLoading(true);
            try {
                const companyDocRef = doc(firestore, 'companies', INDITEX_COMPANY_ID);
                const companySnapshot = await getDoc(companyDocRef);

                if (!companySnapshot.exists()) {
                    toast({ variant: 'destructive', title: 'Error de Configuración', description: `La empresa Inditex con ID "${INDITEX_COMPANY_ID}" no fue encontrada.` });
                    setIsLoading(false);
                    return;
                }
                const companyData = { ...companySnapshot.data(), id: companySnapshot.id } as Company;
                setInditexCompany(companyData);
                
                const menuQuery = query(collection(firestore, `companies/${companyData.id}/menuItems`), orderBy('name'));
                const menuSnapshot = await getDocs(menuQuery);
                setMenuItems(menuSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as MenuItem)));

            } catch (error: any) {
                 toast({ variant: 'destructive', title: 'Error cargando datos', description: error.message });
            } finally {
                setIsLoading(false);
            }
        };
        fetchPosData();
    }, [firestore, toast]);
    
    const addToOrder = (item: MenuItem) => {
        setOrder(prev => {
            const existingItem = prev.find(orderItem => orderItem.itemId === item.id);
            if (existingItem) {
                return prev.map(orderItem => 
                    orderItem.itemId === item.id 
                    ? { ...orderItem, quantity: orderItem.quantity + 1 } 
                    : orderItem
                );
            }
            return [...prev, { itemId: item.id, name: item.name, price: item.price, quantity: 1 }];
        });
    };

    const removeFromOrder = (itemId: string) => {
        setOrder(prev => {
            const existingItem = prev.find(orderItem => orderItem.itemId === itemId);
            if (existingItem && existingItem.quantity > 1) {
                return prev.map(orderItem => 
                    orderItem.itemId === itemId 
                    ? { ...orderItem, quantity: orderItem.quantity - 1 } 
                    : orderItem
                );
            }
            return prev.filter(orderItem => orderItem.itemId !== itemId);
        });
    };
    
    const clearOrder = () => {
        setOrder([]);
    }

    const orderTotal = useMemo(() => {
        return order.reduce((total, item) => total + item.price * item.quantity, 0);
    }, [order]);

    const handleConfirmOrder = async () => {
        if (!firestore || !inditexCompany || order.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Se necesita al menos un producto para confirmar.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const consumptionData: Omit<Consumption, 'id'> = {
                employeeId: 'anonymous',
                employeeNumber: 'N/A',
                name: 'Venta General',
                companyId: inditexCompany.id,
                timestamp: new Date().toISOString(),
                voided: false,
                items: order,
                totalAmount: orderTotal,
                status: 'completed',
            };

            const consumptionsCollection = collection(firestore, `companies/${inditexCompany.id}/consumptions`);
            await addDocumentNonBlocking(consumptionsCollection, consumptionData);

            toast({
                title: 'Venta Confirmada',
                description: `Venta por $${orderTotal.toFixed(2)} registrada.`,
                className: 'bg-green-100 dark:bg-green-900 border-green-500'
            });

            setOrder([]);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error al confirmar', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }


    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="ml-4 text-lg">Cargando POS Inditex...</p>
            </div>
        );
    }
    
    if (!inditexCompany) {
         return (
             <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
                <Card className="w-full max-w-sm mx-4 shadow-xl text-center">
                    <CardHeader>
                        <CardTitle className="flex flex-col items-center gap-2">
                            <ShieldAlert className="h-12 w-12 text-destructive" />
                            Error de Configuración
                        </CardTitle>
                        <CardDescription>La empresa Inditex no se pudo encontrar. Verifique el ID en el código fuente.</CardDescription>
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
        <div className="bg-gray-50 dark:bg-gray-950 min-h-screen">
             <header className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-3">
                        <Logo />
                        <div className='text-center'>
                             <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">POS Inditex</h1>
                             <p className='text-sm text-muted-foreground'>{inditexCompany.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <Button variant="outline" onClick={() => router.push('/selection')}>
                                <Home className="mr-2 h-4 w-4" />
                                Volver al menú
                            </Button>
                        </div>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <MenuSelector 
                            menuItems={menuItems} 
                            onAddToOrder={addToOrder}
                            companyName={inditexCompany.name}
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <OrderSummary
                            order={order}
                            total={orderTotal}
                            onRemove={removeFromOrder}
                            onClear={clearOrder}
                            onConfirm={handleConfirmOrder}
                            isSubmitting={isSubmitting}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};

const MenuSelector: FC<{ menuItems: MenuItem[], onAddToOrder: (item: MenuItem) => void, companyName: string }> = ({ menuItems, onAddToOrder, companyName }) => {
    const groupedMenu = useMemo(() => {
        return menuItems.reduce((acc, item) => {
            const category = item.category || 'Varios';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        }, {} as Record<string, MenuItem[]>);
    }, [menuItems]);

    const categories = Object.keys(groupedMenu);

    return (
        <Card className="shadow-lg">
             <CardHeader>
                <CardTitle className='flex items-center gap-2'><Utensils className='h-6 w-6' />Menú de {companyName}</CardTitle>
                <CardDescription>Seleccione los productos para añadir a la venta.</CardDescription>
            </CardHeader>
            <CardContent>
                 {categories.length > 0 ? (
                    <Tabs defaultValue={categories[0]} className="w-full">
                        <TabsList>
                            {categories.map(category => (
                                <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
                            ))}
                        </TabsList>
                        {categories.map(category => (
                            <TabsContent key={category} value={category}>
                                <ScrollArea className="h-[60vh] pr-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-4">
                                    {groupedMenu[category].map(item => (
                                        <button key={item.id} onClick={() => onAddToOrder(item)} className="group relative flex flex-col items-center justify-center p-2 text-center bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary transition-all duration-200 aspect-square">
                                            <p className="font-semibold">{item.name}</p>
                                            <p className="text-sm text-muted-foreground">${item.price.toFixed(2)}</p>
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <PlusCircle className="h-5 w-5 text-primary"/>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                </ScrollArea>
                            </TabsContent>
                        ))}
                    </Tabs>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
                        <Utensils className="h-12 w-12" />
                        <p className="mt-4 text-lg">No hay productos en el menú.</p>
                        <p className="text-sm">Añada productos desde el panel de Configuración.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

const OrderSummary: FC<{ order: OrderItem[], total: number, onRemove: (itemId: string) => void, onClear: () => void, onConfirm: () => void, isSubmitting: boolean }> = ({ order, total, onRemove, onClear, onConfirm, isSubmitting }) => {
    return (
        <Card className="shadow-lg sticky top-24">
             <CardHeader>
                <CardTitle className='flex items-center gap-2'><ShoppingCart className='h-6 w-6'/>Resumen de Venta</CardTitle>
                <CardDescription>
                    Venta general al público.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className={cn("transition-all duration-300", order.length > 0 ? "h-80" : "h-20")}>
                    {order.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <p>La orden está vacía</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {order.map(item => (
                                <div key={item.itemId} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{item.name}</p>
                                        <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} x {item.quantity}</p>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                                        <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => onRemove(item.itemId)}><Trash2 className='h-5 w-5 text-red-500'/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <div className="mt-4 border-t pt-4 space-y-4">
                    <div className="flex justify-between items-center text-xl font-bold">
                        <p>Total:</p>
                        <p>${total.toFixed(2)}</p>
                    </div>
                    <Button 
                        className="w-full h-14 text-lg" 
                        onClick={onConfirm} 
                        disabled={isSubmitting || order.length === 0}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : <CheckCircle className="h-6 w-6 mr-2" />}
                        Confirmar Venta
                    </Button>
                    <Button className="w-full" variant="outline" onClick={onClear} disabled={isSubmitting || order.length === 0}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Limpiar Venta
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

    