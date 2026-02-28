'use client';

import { useState, type FC } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import { type Company, type MenuItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Utensils, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const menuItemSchema = z.object({
    sku: z.string().optional(),
    name: z.string().min(1, { message: "El nombre es obligatorio." }),
    price: z.coerce.number().min(0, { message: "El precio debe ser un número positivo." }),
    category: z.string().min(1, { message: "La categoría es obligatoria." }),
});
type MenuItemFormData = z.infer<typeof menuItemSchema>;

export const MenuTab: FC<{ companies: Company[] | null, companiesLoading: boolean }> = ({ companies, companiesLoading }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

    const menuItemsQuery = useMemoFirebase(() =>
        firestore && selectedCompanyId ? query(collection(firestore, `companies/${selectedCompanyId}/menuItems`), orderBy('name')) : null
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

        const dataToSave: Omit<MenuItem, 'id'> = { ...data, companyId: selectedCompanyId };
        const menuItemsCollection = collection(firestore, `companies/${selectedCompanyId}/menuItems`);

        addDocumentNonBlocking(menuItemsCollection, dataToSave)
            .then(() => {
                toast({ title: 'Producto Añadido', description: `"${data.name}" fue añadido al menú.` });
                form.reset();
            })
            .catch((error: unknown) => {
                toast({ variant: 'destructive', title: 'Error al añadir producto', description: error instanceof Error ? error.message : 'Ocurrió un error inesperado. Verifique los permisos de Firestore.' });
            });
    };

    const handleDeleteMenuItem = async (itemId: string) => {
         if (!firestore || !selectedCompanyId) return;
         const itemDocRef = doc(firestore, `companies/${selectedCompanyId}/menuItems`, itemId);
         deleteDocumentNonBlocking(itemDocRef)
            .then(() => {
                toast({ title: 'Producto Eliminado', description: 'El producto fue eliminado del menú.' });
            })
            .catch((error: unknown) => {
                toast({ variant: 'destructive', title: 'Error al eliminar', description: error instanceof Error ? error.message : 'Ocurrió un error inesperado.' });
            });
    };

    const categories = ["Bebidas", "Platillos", "Postres"];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <Card className="shadow-card hover:shadow-card-hover transition-shadow">
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
                <Card className="shadow-card hover:shadow-card-hover transition-shadow">
                    <CardHeader>
                        <CardTitle>Menú de {companies?.find(c=>c.id === selectedCompanyId)?.name || '...'}</CardTitle>
                        <CardDescription>Lista de productos disponibles para la empresa seleccionada.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {(menuItemsLoading || (selectedCompanyId && companiesLoading)) ? (
                            <div className="flex h-48 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : !selectedCompanyId ? (
                            <div className="flex h-48 w-full items-center justify-center text-muted-foreground">Seleccione una empresa para ver su menú.</div>
                        ) : menuItems && menuItems.length === 0 ? (
                            <EmptyState icon={Utensils} title="Este menú está vacío." />
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
