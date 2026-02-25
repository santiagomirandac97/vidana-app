
'use client';

import { useState, useEffect, useMemo, type FC, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs, orderBy, limit, getDoc, Timestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { type Company, type Employee, type UserProfile, type MenuItem, type OrderItem, type Consumption } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, Home, Search, User, Utensils, MinusCircle, PlusCircle, ShoppingCart, Trash2, CheckCircle, Download, Calendar as CalendarIcon } from 'lucide-react';
import { AppShell, PageHeader } from '@/components/layout';
import { cn, exportToCsv } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';


const KIOSK_COMPANY_ID = "Yzf6ucrafGkOPqbqCJpl"; // Configure the target company ID here

export default function KioskPage() {
    const { user, isLoading: userLoading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!userLoading && !user) {
            router.push('/login');
        }
    }, [user, userLoading, router]);


    const { firestore } = useFirebase();
    const userProfileRef = useMemoFirebase(() =>
        firestore && user ? doc(firestore, `users/${user.uid}`) : null
    , [firestore, user]);
    const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);
    
    const isLoading = userLoading || profileLoading;

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="ml-4 text-lg">Cargando Kiosk...</p>
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
                        <Button onClick={() => router.push('/')} className="w-full">
                            <Home className="mr-2 h-4 w-4" />
                            Volver al Inicio
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return <KioskDashboard />;
}


const KioskDashboard: FC = () => {
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    const [kioskCompany, setKioskCompany] = useState<Company | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [consumptions, setConsumptions] = useState<Consumption[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [order, setOrder] = useState<OrderItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch company, employees, and menu for the designated Kiosk company
    useEffect(() => {
        if (!firestore) return;
        const fetchKioskData = async () => {
            setIsLoading(true);
            try {
                // 1. Find the company by ID
                const companyDocRef = doc(firestore, 'companies', KIOSK_COMPANY_ID);
                const companySnapshot = await getDoc(companyDocRef);

                if (!companySnapshot.exists()) {
                    toast({ variant: 'destructive', title: 'Error de Configuración', description: `La empresa con ID "${KIOSK_COMPANY_ID}" no fue encontrada.` });
                    setIsLoading(false);
                    return;
                }
                const companyData = { ...companySnapshot.data(), id: companySnapshot.id } as Company;
                setKioskCompany(companyData);

                // 2. Fetch employees for that company
                const employeesQuery = query(collection(firestore, `companies/${companyData.id}/employees`));
                const employeesSnapshot = await getDocs(employeesQuery);
                setEmployees(employeesSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as Employee)));
                
                // 3. Fetch menu items for that company
                const menuQuery = query(collection(firestore, `companies/${companyData.id}/menuItems`), orderBy('name'));
                const menuSnapshot = await getDocs(menuQuery);
                setMenuItems(menuSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as MenuItem)));

                // 4. Fetch consumptions from the last 30 days for reporting
                const thirtyDaysAgo = subDays(new Date(), 30);
                const consumptionsQuery = query(
                    collection(firestore, `companies/${companyData.id}/consumptions`),
                    where('timestamp', '>=', thirtyDaysAgo.toISOString())
                );
                const consumptionsSnapshot = await getDocs(consumptionsQuery);
                setConsumptions(consumptionsSnapshot.docs.map(d => ({...d.data(), id: d.id} as Consumption)));


            } catch (error: any) {
                 toast({ variant: 'destructive', title: 'Error cargando datos', description: error.message });
            } finally {
                setIsLoading(false);
            }
        };
        fetchKioskData();
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
        if (!firestore || !kioskCompany || !selectedEmployee || order.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Se necesita un cliente y al menos un producto para confirmar.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const consumptionData: Omit<Consumption, 'id'> = {
                employeeId: selectedEmployee.id!,
                employeeNumber: selectedEmployee.employeeNumber,
                name: selectedEmployee.name,
                companyId: kioskCompany.id,
                timestamp: new Date().toISOString(),
                voided: false,
                items: order,
                totalAmount: orderTotal,
                status: 'pending',
            };

            const consumptionsCollection = collection(firestore, `companies/${kioskCompany.id}/consumptions`);
            await addDocumentNonBlocking(consumptionsCollection, consumptionData);

            toast({
                title: 'Orden Confirmada',
                description: `Orden de ${selectedEmployee.name} por $${orderTotal.toFixed(2)} registrada.`,
                className: 'bg-green-100 dark:bg-green-900 border-green-500'
            });

            // Reset state
            setSelectedEmployee(null);
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
                <p className="ml-4 text-lg">Cargando Kiosk...</p>
            </div>
        );
    }
    
    if (!kioskCompany) {
         return (
             <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
                <Card className="w-full max-w-sm mx-4 shadow-xl text-center">
                    <CardHeader>
                        <CardTitle className="flex flex-col items-center gap-2">
                            <ShieldAlert className="h-12 w-12 text-destructive" />
                            Error de Configuración
                        </CardTitle>
                        <CardDescription>La empresa para el Kiosk no se pudo encontrar. Verifique el ID en el código fuente.</CardDescription>
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
        <AppShell>
            <div className="p-4 sm:p-6">
                <PageHeader title="Kiosk Televisa" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Menu and Employee Selection */}
                    <div className="lg:col-span-2">
                        {!selectedEmployee ? (
                            <EmployeeSelector employees={employees} onSelect={setSelectedEmployee} />
                        ) : (
                            <MenuSelector
                                menuItems={menuItems}
                                onAddToOrder={addToOrder}
                                selectedEmployee={selectedEmployee}
                                onClearEmployee={() => setSelectedEmployee(null)}
                             />
                        )}
                    </div>

                    {/* Order Summary */}
                    <div className="lg:col-span-1">
                        <OrderSummary
                            order={order}
                            total={orderTotal}
                            onRemove={removeFromOrder}
                            onClear={clearOrder}
                            onConfirm={handleConfirmOrder}
                            isSubmitting={isSubmitting}
                            selectedEmployee={selectedEmployee}
                        />
                    </div>
                </div>
            </div>
        </AppShell>
    );
};

// Sub-components for Kiosk
const EmployeeSelector: FC<{ employees: Employee[], onSelect: (employee: Employee) => void }> = ({ employees, onSelect }) => {
    const [search, setSearch] = useState('');
    const filteredEmployees = useMemo(() => {
        if (!search) return employees;
        return employees.filter(e =>
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            e.employeeNumber.includes(search)
        );
    }, [search, employees]);

    return (
        <Card className="shadow-card">
            <CardHeader>
                <CardTitle className='flex items-center gap-2'><User className='h-6 w-6'/>Seleccionar Cliente</CardTitle>
                <CardDescription>Busque por nombre o número de empleado para iniciar una orden.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                        placeholder="Buscar empleado..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="text-lg h-14 pl-10"
                        autoFocus
                    />
                </div>
                <ScrollArea className="h-[60vh] rounded-md border">
                    <div className="p-2">
                        {filteredEmployees.map(employee => (
                            <button key={employee.id} onClick={() => onSelect(employee)} className="w-full text-left p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <p className="font-medium">{employee.name}</p>
                                <p className="text-sm text-muted-foreground">#{employee.employeeNumber}</p>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    )
}

const MenuSelector: FC<{ menuItems: MenuItem[], onAddToOrder: (item: MenuItem) => void, selectedEmployee: Employee, onClearEmployee: () => void }> = ({ menuItems, onAddToOrder, selectedEmployee, onClearEmployee }) => {
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
        <Card className="shadow-card">
             <CardHeader>
                <div className='flex justify-between items-center'>
                    <CardTitle className='flex items-center gap-2'><Utensils className='h-6 w-6' />Menú</CardTitle>
                    <div className='text-right'>
                        <p className='font-semibold'>{selectedEmployee.name}</p>
                        <Button variant='link' size='sm' className='h-auto p-0' onClick={onClearEmployee}>Cambiar cliente</Button>
                    </div>
                </div>
                <CardDescription>Seleccione los productos para añadir a la orden.</CardDescription>
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
                                <ScrollArea className="h-[55vh] pr-4">
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
                    <div className="flex flex-col items-center justify-center h-[55vh] text-muted-foreground">
                        <Utensils className="h-12 w-12" />
                        <p className="mt-4 text-lg">No hay productos en el menú.</p>
                        <p className="text-sm">Añada productos desde el panel de Configuración.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


const OrderSummary: FC<{ order: OrderItem[], total: number, onRemove: (itemId: string) => void, onClear: () => void, onConfirm: () => void, isSubmitting: boolean, selectedEmployee: Employee | null }> = ({ order, total, onRemove, onClear, onConfirm, isSubmitting, selectedEmployee }) => {
    return (
        <Card className="shadow-card sticky top-24">
             <CardHeader>
                <CardTitle className='flex items-center gap-2'><ShoppingCart className='h-6 w-6'/>Resumen de Orden</CardTitle>
                <CardDescription>
                    {selectedEmployee ? `Pedido para: ${selectedEmployee.name}` : 'Esperando selección de cliente...'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className={cn("transition-all duration-300", order.length > 0 ? "h-64" : "h-20")}>
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
                                        <Button size='icon' variant='ghost' className='h-7 w-7' onClick={() => onRemove(item.itemId)}><MinusCircle className='h-5 w-5 text-red-500'/></Button>
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
                        disabled={isSubmitting || order.length === 0 || !selectedEmployee}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : <CheckCircle className="h-6 w-6 mr-2" />}
                        Confirmar Orden
                    </Button>
                    <Button className="w-full" variant="outline" onClick={onClear} disabled={isSubmitting || order.length === 0}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Limpiar Orden
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

const DownloadReportDialog: FC<{company: Company, consumptions: Consumption[]}> = ({ company, consumptions }) => {
    const { toast } = useToast();
    const [date, setDate] = useState<DateRange | undefined>();

    const handleDownload = () => {
        if (!date?.from || !date?.to) {
            toast({variant: 'destructive', title: 'Error', description: 'Por favor seleccione un rango de fechas.'});
            return;
        }

        const from = date.from.getTime();
        const to = date.to.getTime() + (24 * 60 * 60 * 1000 - 1); // include full end day

        const filteredConsumptions = consumptions.filter(c => {
            const c_time = new Date(c.timestamp).getTime();
            return c_time >= from && c_time <= to;
        });
        
        if (filteredConsumptions.length === 0) {
             toast({variant: 'destructive', title: 'Sin Datos', description: 'No se encontraron consumos en el rango de fechas seleccionado.'});
            return;
        }

        const rows: (string | number)[][] = [];
        const headers = ['Fecha', 'Hora', 'No. Empleado', 'Nombre', 'Items', 'Total'];
        rows.push(headers);

        filteredConsumptions.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .forEach(c => {
            const consumptionDate = new Date(c.timestamp);
            rows.push([
                format(consumptionDate, "yyyy-MM-dd"),
                format(consumptionDate, "HH:mm:ss"),
                c.employeeNumber,
                c.name,
                c.items?.map(i => `${i.quantity}x ${i.name}`).join(', ') || '',
                c.totalAmount?.toFixed(2) || '0.00'
            ]);
        });

        const filename = `Reporte_Kiosk_${company.name}_${format(date.from, "yyyy-MM-dd")}_a_${format(date.to, "yyyy-MM-dd")}.csv`;
        exportToCsv(filename, rows);
        toast({ title: 'Reporte Descargado', description: `${filteredConsumptions.length} registros exportados.`});
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline"><Download className="mr-2 h-4 w-4"/>Descargar Reporte</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Descargar Reporte de Consumos</DialogTitle>
                    <DialogDescription>Seleccione un rango de fechas para exportar las órdenes del Kiosk.</DialogDescription>
                </DialogHeader>
                 <div className="space-y-4 py-4">
                    <label>Rango de Fechas</label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                            )}
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                                date.to ? (
                                <>
                                    {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                                    {format(date.to, "LLL dd, y", { locale: es })}
                                </>
                                ) : (
                                format(date.from, "LLL dd, y", { locale: es })
                                )
                            ) : (
                                <span>Elige una fecha</span>
                            )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={1}
                            locale={es}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                <DialogFooter>
                    <Button onClick={handleDownload} disabled={!date?.from || !date?.to}>
                        <Download className="mr-2 h-4 w-4"/>
                        Descargar CSV
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
