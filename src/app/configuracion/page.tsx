
'use client';

import { useState, useEffect, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc, useAuth } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { type Company, type UserProfile, type AppConfiguration } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, Home, LogOut, Building, PlusCircle, Trash2, Edit } from 'lucide-react';
import { Logo } from '@/components/logo';

// Zod schema for company form validation
const companySchema = z.object({
  name: z.string().min(1, { message: "El nombre es obligatorio." }),
  mealPrice: z.coerce.number().min(0, { message: "El precio debe ser un número positivo." }).optional().default(0),
  dailyTarget: z.coerce.number().min(0, { message: "El objetivo debe ser un número positivo." }).optional().default(0),
  billingNote: z.string().optional(),
});
type CompanyFormData = z.infer<typeof companySchema>;

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
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    const companiesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null
    , [firestore]);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

    const form = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema),
        defaultValues: {
            name: '',
            mealPrice: 0,
            dailyTarget: 0,
            billingNote: '',
        },
    });

    const onSubmit: SubmitHandler<CompanyFormData> = async (data) => {
        if (!firestore) return;
        try {
            const companiesCollection = collection(firestore, 'companies');
            await addDocumentNonBlocking(companiesCollection, data);
            toast({
                title: 'Empresa Creada',
                description: `La empresa "${data.name}" ha sido añadida exitosamente.`,
            });
            form.reset();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error al crear la empresa',
                description: error.message || 'Ocurrió un error inesperado.',
            });
        }
    };

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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle>Añadir Nueva Empresa</CardTitle>
                                <CardDescription>Complete el formulario para registrar una nueva empresa en el sistema.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                                                        <Input type="number" placeholder="0.00" {...field} />
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
                                        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                                            {form.formState.isSubmitting ? (
                                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</>
                                            ) : (
                                                <><PlusCircle className="mr-2 h-4 w-4" /> Crear Empresa</>
                                            )}
                                        </Button>
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
                                     <div className="flex h-48 w-full items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                     </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nombre</TableHead>
                                                <TableHead className="text-right">Precio Comida</TableHead>
                                                <TableHead className="text-right">Objetivo Diario</TableHead>
                                                <TableHead>Nota Facturación</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {companies?.map(company => (
                                                <TableRow key={company.id}>
                                                    <TableCell className="font-medium">{company.name}</TableCell>
                                                    <TableCell className="text-right">${(company.mealPrice || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">{company.dailyTarget || 'N/A'}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{company.billingNote || 'N/A'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};

