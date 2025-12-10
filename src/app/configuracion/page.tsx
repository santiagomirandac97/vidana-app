
'use client';

import { useState, useEffect, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import { type Company, type UserProfile, type MenuItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, Home, PlusCircle, Edit, Utensils, Trash2 } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Zod schema for company form validation
const companySchema = z.object({
  name: z.string().min(1, { message: "El nombre es obligatorio." }),
  mealPrice: z.coerce.number().min(0, { message: "El precio debe ser un número positivo." }).optional().default(0),
  dailyTarget: z.coerce.number().min(0, { message: "El objetivo debe ser un número positivo." }).optional().default(0),
  billingNote: z.string().optional(),
});
type CompanyFormData = z.infer<typeof companySchema>;

const menuItemSchema = z.object({
    sku: z.string().optional(),
    name: z.string().min(1, { message: "El nombre es obligatorio." }),
    price: z.coerce.number().min(0, { message: "El precio debe ser un número positivo." }),
    category: z.string().min(1, { message: "La categoría es obligatoria." }),
});
type MenuItemFormData = z.infer<typeof menuItemSchema>;

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
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="ml-4 text-lg">Verificando acceso de administrador...</p>
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

    return <ConfiguracionDashboard />;
}

const ConfiguracionDashboard: FC = () => {
    const router = useRouter();
    const { firestore } = useFirebase();

    const companiesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null
    , [firestore]);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

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
                 <Tabs defaultValue="companies">
                    <TabsList className="grid w-full grid-cols-2 mb-8">
                        <TabsTrigger value="companies">Gestionar Empresas</TabsTrigger>
                        <TabsTrigger value="menus">Gestionar Menús</TabsTrigger>
                    </TabsList>
                    <TabsContent value="companies">
                        <CompanyManagementTab companies={companies} companiesLoading={companiesLoading} />
                    </TabsContent>
                    <TabsContent value="menus">
                        <MenuManagementTab companies={companies} companiesLoading={companiesLoading} />
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

// =================================================================
// Company Management Tab
// =================================================================
const CompanyManagementTab: FC<{companies: Company[] | null, companiesLoading: boolean}> = ({ companies, companiesLoading }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    const form = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema),
        defaultValues: { name: '', mealPrice: 0, dailyTarget: 0, billingNote: '' },
    });

    const onSubmit: SubmitHandler<CompanyFormData> = async (data) => {
        if (!firestore) return;
        
        const dataToSave = {
            name: data.name,
            mealPrice: data.mealPrice,
            dailyTarget: data.dailyTarget,
            billingNote: data.billingNote,
        };

        const companiesCollection = collection(firestore, 'companies');
        addDocumentNonBlocking(companiesCollection, dataToSave)
            .then(() => {
                toast({ title: 'Empresa Creada', description: `La empresa "${data.name}" ha sido añadida exitosamente.` });
                form.reset();
            })
            .catch((error: any) => {
                toast({ variant: 'destructive', title: 'Error al crear la empresa', description: error.message || 'Ocurrió un error inesperado.' });
            });
    };
    
    const handleUpdateCompany = async (companyId: string, data: CompanyFormData) => {
        if (!firestore) return;
        const companyDocRef = doc(firestore, 'companies', companyId);
        updateDocumentNonBlocking(companyDocRef, data)
            .then(() => {
                toast({ title: 'Empresa Actualizada', description: 'Los datos de la empresa han sido guardados.' });
                setEditingCompany(null);
            })
            .catch((error: any) => {
                toast({ variant: 'destructive', title: 'Error al actualizar', description: error.message || 'Ocurrió un error inesperado.' });
            });
    };


    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Añadir Nueva Empresa</CardTitle>
                        <CardDescription>Complete el formulario para registrar una nueva empresa.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {/* Form Fields for Company */}
                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre de la Empresa</FormLabel><FormControl><Input placeholder="Ej., Nueva Empresa S.A." {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="mealPrice" render={({ field }) => (<FormItem><FormLabel>Precio de Comida</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="dailyTarget" render={({ field }) => (<FormItem><FormLabel>Objetivo Diario de Comidas</FormLabel><FormControl><Input type="number" placeholder="Ej., 300" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="billingNote" render={({ field }) => (<FormItem><FormLabel>Nota de Facturación</FormLabel><FormControl><Textarea placeholder="Ej., Se cobra un mínimo de 300 comidas de L-J." {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</>) : (<><PlusCircle className="mr-2 h-4 w-4" /> Crear Empresa</>)}</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                <Card className="shadow-lg">
                        <CardHeader>
                        <CardTitle>Empresas Existentes</CardTitle>
                        <CardDescription>Lista de todas las empresas actualmente en el sistema.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {companiesLoading ? (
                                <div className="flex h-48 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                            <Table>
                                <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead className="text-right">Precio Comida</TableHead><TableHead className="text-right">Objetivo Diario</TableHead><TableHead>Nota Facturación</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {companies?.map(company => (
                                        <TableRow key={company.id}>
                                            <TableCell className="font-medium">{company.name}</TableCell>
                                            <TableCell className="text-right">${(company.mealPrice || 0).toFixed(2)}</TableCell>
                                            <TableCell className="text-right">{company.dailyTarget || 'N/A'}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{company.billingNote || 'N/A'}</TableCell>
                                            <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setEditingCompany(company)}><Edit className="h-4 w-4" /></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
        {editingCompany && (
                <EditCompanyDialog company={editingCompany} isOpen={!!editingCompany} onClose={() => setEditingCompany(null)} onSave={handleUpdateCompany} />
        )}
        </>
    );
};


// =================================================================
// Menu Management Tab
// =================================================================
const MenuManagementTab: FC<{ companies: Company[] | null, companiesLoading: boolean }> = ({ companies, companiesLoading }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

    const menuItemsQuery = useMemoFirebase(() => 
        firestore && selectedCompanyId ? query(collection(firestore, `companies/${selectedCompanyId}/menuItems`), orderBy('category'), orderBy('name')) : null
    , [firestore, selectedCompanyId]);
    const { data: menuItems, isLoading: menuItemsLoading } = useCollection<MenuItem>(menuItemsQuery);

    const form = useForm<MenuItemFormData>({
        resolver: zodResolver(menuItemSchema),
        defaultValues: { sku: '', name: '', price: 0, category: '' },
    });

    const onMenuItemSubmit: SubmitHandler<MenuItemFormData> = (data) => {
        if (!firestore || !selectedCompanyId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, seleccione una empresa primero.' });
            return;
        }

        const dataToSave = { ...data, companyId: selectedCompanyId };
        const menuItemsCollection = collection(firestore, `companies/${selectedCompanyId}/menuItems`);

        addDocumentNonBlocking(menuItemsCollection, dataToSave)
            .then(() => {
                toast({ title: 'Producto Añadido', description: `"${data.name}" fue añadido al menú.` });
                form.reset();
            })
            .catch((error: any) => {
                toast({ variant: 'destructive', title: 'Error al añadir producto', description: error.message || 'Ocurrió un error inesperado. Verifique los permisos de Firestore.' });
            });
    };
    
    const handleDeleteMenuItem = async (itemId: string) => {
         if (!firestore || !selectedCompanyId) return;
         const itemDocRef = doc(firestore, `companies/${selectedCompanyId}/menuItems`, itemId);
         deleteDocumentNonBlocking(itemDocRef)
            .then(() => {
                toast({ title: 'Producto Eliminado', description: 'El producto fue eliminado del menú.' });
            })
            .catch((error: any) => {
                toast({ variant: 'destructive', title: 'Error al eliminar', description: error.message || 'Ocurrió un error inesperado.' });
            });
    };

    const categories = ["Bebidas", "Platillos", "Postres"];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Utensils className="h-5 w-5" />Añadir Producto al Menú</CardTitle>
                        <CardDescription>Seleccione una empresa y añada un nuevo producto a su menú.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onMenuItemSubmit)} className="space-y-6">
                                <FormItem>
                                    <FormLabel>Empresa</FormLabel>
                                    <Select onValueChange={setSelectedCompanyId} value={selectedCompanyId} disabled={companiesLoading}>
                                        <FormControl>
                                            <SelectTrigger>{selectedCompanyId ? companies?.find(c=>c.id === selectedCompanyId)?.name : "Seleccione una empresa"}</SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                                <FormField control={form.control} name="sku" render={({ field }) => (<FormItem><FormLabel>SKU (Opcional)</FormLabel><FormControl><Input placeholder="Ej., BEB-001" {...field} disabled={!selectedCompanyId} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre del Producto</FormLabel><FormControl><Input placeholder="Ej., Café Americano" {...field} disabled={!selectedCompanyId} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>Precio</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} disabled={!selectedCompanyId} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Categoría</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedCompanyId}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccione una categoría" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {categories.map(category => (
                                                        <SelectItem key={category} value={category}>{category}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || !selectedCompanyId}>{form.formState.isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Añadiendo...</>) : (<><PlusCircle className="mr-2 h-4 w-4" /> Añadir Producto</>)}</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Menú de {companies?.find(c=>c.id === selectedCompanyId)?.name || '...'}</CardTitle>
                        <CardDescription>Lista de productos disponibles para la empresa seleccionada.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {(menuItemsLoading || (selectedCompanyId && companiesLoading)) ? (
                            <div className="flex h-48 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : !selectedCompanyId ? (
                            <div className="flex h-48 w-full items-center justify-center text-muted-foreground">Seleccione una empresa para ver su menú.</div>
                        ) : (
                            <Table>
                                <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Nombre</TableHead><TableHead>Categoría</TableHead><TableHead className="text-right">Precio</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {menuItems?.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-muted-foreground">{item.sku || 'N/A'}</TableCell>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell>{item.category}</TableCell>
                                            <TableCell className="text-right">${(item.price || 0).toFixed(2)}</TableCell>
                                            <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteMenuItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};


interface EditCompanyDialogProps {
    company: Company;
    isOpen: boolean;
    onClose: () => void;
    onSave: (companyId: string, data: CompanyFormData) => void;
}

const EditCompanyDialog: FC<EditCompanyDialogProps> = ({ company, isOpen, onClose, onSave }) => {
    const form = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema),
        defaultValues: {
            name: company.name || '',
            mealPrice: company.mealPrice || 0,
            dailyTarget: company.dailyTarget || 0,
            billingNote: company.billingNote || '',
        },
    });

    useEffect(() => {
        form.reset({
            name: company.name || '',
            mealPrice: company.mealPrice || 0,
            dailyTarget: company.dailyTarget || 0,
            billingNote: company.billingNote || '',
        });
    }, [company, form]);

    const handleSave = (data: CompanyFormData) => {
        onSave(company.id, data);
    };

    return (
         <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Empresa</DialogTitle>
                    <DialogDescription>Modifique los detalles de {company.name}.</DialogDescription>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6 pt-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre de la Empresa</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej., Nueva Empresa S.A." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="mealPrice"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Precio de Comida</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dailyTarget"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Objetivo Diario de Comidas (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="Ej., 300" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="billingNote"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nota de Facturación (Opcional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Ej., Se cobra un mínimo de 300 comidas de L-J." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="ghost">Cancelar</Button>
                            </DialogClose>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                                ) : (
                                    <>Guardar Cambios</>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

    