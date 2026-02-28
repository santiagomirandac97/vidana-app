'use client';

import { useState, useEffect, type FC } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { type Company } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit } from 'lucide-react';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn } from '@/lib/utils';

// Zod schema for company form validation
const companySchema = z.object({
  name: z.string().min(1, { message: "El nombre es obligatorio." }),
  mealPrice: z.coerce.number().min(0, { message: "El precio debe ser un número positivo." }).optional().default(0),
  dailyTarget: z.coerce.number().min(0, { message: "El objetivo debe ser un número positivo." }).optional().default(0),
  targetDays: z.array(z.number()).optional().default([1, 2, 3, 4]),
  billingNote: z.string().optional(),
  stockLookbackDays: z.coerce.number().min(7).max(90).optional().default(30),
  restockLeadDays: z.coerce.number().min(1).max(30).optional().default(7),
  targetFoodCostPct: z.coerce.number().min(1).max(100).optional().default(35),
  billingEmail: z.string().email({ message: "Correo inválido." }).optional().or(z.literal('')),
});
type CompanyFormData = z.infer<typeof companySchema>;

// Days of the week for the target-days picker (Mon-first order)
const WEEK_DAYS = [
  { label: 'Lu', dow: 1 },
  { label: 'Ma', dow: 2 },
  { label: 'Mi', dow: 3 },
  { label: 'Ju', dow: 4 },
  { label: 'Vi', dow: 5 },
  { label: 'Sá', dow: 6 },
  { label: 'Do', dow: 0 },
];

export const EmpresasTab: FC<{companies: Company[] | null, companiesLoading: boolean}> = ({ companies, companiesLoading }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    const form = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema),
        defaultValues: { name: '', mealPrice: 0, dailyTarget: 0, targetDays: [1, 2, 3, 4], billingNote: '', stockLookbackDays: 30, restockLeadDays: 7, targetFoodCostPct: 35, billingEmail: '' },
    });

    const onSubmit: SubmitHandler<CompanyFormData> = async (data) => {
        if (!firestore) return;

        const dataToSave = {
            name: data.name,
            mealPrice: data.mealPrice,
            dailyTarget: data.dailyTarget,
            targetDays: data.targetDays,
            billingNote: data.billingNote,
        };

        const companiesCollection = collection(firestore, 'companies');
        addDocumentNonBlocking(companiesCollection, dataToSave)
            .then(() => {
                toast({ title: 'Empresa Creada', description: `La empresa "${data.name}" ha sido añadida exitosamente.` });
                form.reset();
            })
            .catch((error: unknown) => {
                toast({ variant: 'destructive', title: 'Error al crear la empresa', description: error instanceof Error ? error.message : 'Ocurrió un error inesperado.' });
            });
    };

    const handleUpdateCompany = async (companyId: string, data: CompanyFormData) => {
        if (!firestore) return;
        const companyDocRef = doc(firestore, 'companies', companyId);
        updateDoc(companyDocRef, data)
            .then(() => {
                toast({ title: 'Empresa Actualizada', description: 'Los datos de la empresa han sido guardados.' });
                setEditingCompany(null);
            })
            .catch((error: unknown) => {
                toast({ variant: 'destructive', title: 'Error al actualizar', description: error instanceof Error ? error.message : 'Ocurrió un error inesperado.' });
            });
    };


    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <Card className="shadow-card hover:shadow-card-hover transition-shadow">
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
                                <FormField control={form.control} name="targetDays" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Días que aplica el mínimo</FormLabel>
                                    <FormControl>
                                      <div className="flex gap-1 flex-wrap">
                                        {WEEK_DAYS.map(({ label, dow }) => {
                                          const selected = (field.value ?? [1,2,3,4]).includes(dow);
                                          return (
                                            <button key={dow} type="button"
                                              onClick={() => {
                                                const cur = field.value ?? [1,2,3,4];
                                                field.onChange(selected ? cur.filter((d: number) => d !== dow) : [...cur, dow].sort((a,b)=>a-b));
                                              }}
                                              className={cn('w-9 h-8 text-xs font-medium rounded border transition-colors', selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted')}
                                            >{label}</button>
                                          );
                                        })}
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={form.control} name="billingNote" render={({ field }) => (<FormItem><FormLabel>Nota de Facturación</FormLabel><FormControl><Textarea placeholder="Ej., Se cobra un mínimo de 300 comidas de L-J." {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="stockLookbackDays" render={({ field }) => (<FormItem><FormLabel>Historial Reabasto (días)</FormLabel><FormControl><Input type="number" min={7} max={90} {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="restockLeadDays" render={({ field }) => (<FormItem><FormLabel>Anticipo de Reabasto (días)</FormLabel><FormControl><Input type="number" min={1} max={30} {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="targetFoodCostPct" render={({ field }) => (<FormItem><FormLabel>% Costo Alimentos Objetivo (IA)</FormLabel><FormControl><Input type="number" min={1} max={100} {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="billingEmail" render={({ field }) => (<FormItem><FormLabel>Correo de Facturación</FormLabel><FormControl><Input type="email" placeholder="contacto@empresa.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</>) : (<><PlusCircle className="mr-2 h-4 w-4" /> Crear Empresa</>)}</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                <Card className="shadow-card hover:shadow-card-hover transition-shadow">
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
// Edit Company Dialog
// =================================================================

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
            targetDays: company.targetDays ?? [1, 2, 3, 4],
            billingNote: company.billingNote || '',
            stockLookbackDays: company.stockLookbackDays || 30,
            restockLeadDays: company.restockLeadDays || 7,
            targetFoodCostPct: company.targetFoodCostPct || 35,
            billingEmail: company.billingEmail || '',
        },
    });

    useEffect(() => {
        form.reset({
            name: company.name || '',
            mealPrice: company.mealPrice || 0,
            dailyTarget: company.dailyTarget || 0,
            targetDays: company.targetDays ?? [1, 2, 3, 4],
            billingNote: company.billingNote || '',
            stockLookbackDays: company.stockLookbackDays || 30,
            restockLeadDays: company.restockLeadDays || 7,
            targetFoodCostPct: company.targetFoodCostPct || 35,
            billingEmail: company.billingEmail || '',
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
                            name="targetDays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Días que aplica el mínimo</FormLabel>
                                    <FormControl>
                                        <div className="flex gap-1 flex-wrap">
                                            {WEEK_DAYS.map(({ label, dow }) => {
                                                const selected = (field.value ?? [1,2,3,4]).includes(dow);
                                                return (
                                                    <button key={dow} type="button"
                                                        onClick={() => {
                                                            const cur = field.value ?? [1,2,3,4];
                                                            field.onChange(selected ? cur.filter((d: number) => d !== dow) : [...cur, dow].sort((a,b)=>a-b));
                                                        }}
                                                        className={cn('w-9 h-8 text-xs font-medium rounded border transition-colors', selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted')}
                                                    >{label}</button>
                                                );
                                            })}
                                        </div>
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
                        <FormField
                            control={form.control}
                            name="stockLookbackDays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Historial Reabasto (días)</FormLabel>
                                    <FormControl><Input type="number" min={7} max={90} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="restockLeadDays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Anticipo de Reabasto (días)</FormLabel>
                                    <FormControl><Input type="number" min={1} max={30} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="targetFoodCostPct"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>% Costo Alimentos Objetivo (IA)</FormLabel>
                                    <FormControl><Input type="number" min={1} max={100} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="billingEmail"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Correo de Facturación</FormLabel>
                                    <FormControl><Input type="email" placeholder="contacto@empresa.com" {...field} /></FormControl>
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
