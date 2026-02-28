'use client';

import { useState, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  type Ingredient,
  type StockMovement,
  type Supplier,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatInTimeZone } from 'date-fns-tz';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Truck, ShoppingCart } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

import {
  TIME_ZONE,
  supplierSchema,
  purchaseOrderSchema,
  type SupplierFormValues,
  type PurchaseOrderFormValues,
} from './constants';

// ─── ProveedoresTab ───────────────────────────────────────────────────────────

export interface ProveedoresTabProps {
  suppliers: (Supplier & { id: string })[];
  isLoading: boolean;
  companyId: string;
  firestore: ReturnType<typeof useFirebase>['firestore'];
  toast: ReturnType<typeof useToast>['toast'];
}

export function ProveedoresTab({ suppliers, isLoading, companyId, firestore, toast }: ProveedoresTabProps) {
  const [addOpen, setAddOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({ resolver: zodResolver(supplierSchema) });

  const onAddSupplier = async (values: SupplierFormValues) => {
    if (!firestore) return;
    const colRef = collection(firestore, `companies/${companyId}/suppliers`);
    await addDocumentNonBlocking(colRef, { ...values, active: true });
    toast({ title: 'Proveedor agregado', description: `${values.name} fue registrado.` });
    reset();
    setAddOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Directorio de Proveedores</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Proveedor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo Proveedor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onAddSupplier)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="sup-name">Nombre</Label>
                <Input id="sup-name" {...register('name')} placeholder="Distribuidora XYZ" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-contact">Contacto</Label>
                <Input id="sup-contact" {...register('contact')} placeholder="Nombre del representante" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-phone">Teléfono</Label>
                <Input id="sup-phone" {...register('phone')} placeholder="+52 55 0000 0000" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sup-email">Correo electrónico</Label>
                <Input id="sup-email" type="email" {...register('email')} placeholder="ventas@proveedor.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">No hay proveedores registrados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <Card key={supplier.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{supplier.name}</CardTitle>
                {supplier.contact && (
                  <CardDescription>{supplier.contact}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {supplier.phone && (
                  <p className="text-muted-foreground">Tel: {supplier.phone}</p>
                )}
                {supplier.email && (
                  <p className="text-muted-foreground">{supplier.email}</p>
                )}
                <Badge variant={supplier.active ? 'secondary' : 'outline'}>
                  {supplier.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── OrdenesTab ───────────────────────────────────────────────────────────────

export interface OrdenesTabProps {
  purchaseOrders: (PurchaseOrder & { id: string })[];
  isLoading: boolean;
  suppliers: (Supplier & { id: string })[];
  ingredients: (Ingredient & { id: string })[];
  companyId: string;
  userId: string;
  firestore: ReturnType<typeof useFirebase>['firestore'];
  toast: ReturnType<typeof useToast>['toast'];
}

export function OrdenesTab({
  purchaseOrders,
  isLoading,
  suppliers,
  ingredients,
  companyId,
  userId,
  firestore,
  toast,
}: OrdenesTabProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: { supplierId: '', supplierName: '', items: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchedItems = watch('items');

  const totalCost = useMemo(
    () => watchedItems.reduce((acc, item) => acc + (item.quantity || 0) * (item.unitCost || 0), 0),
    [watchedItems]
  );

  const onCreateOrder = async (values: PurchaseOrderFormValues) => {
    if (!firestore) return;
    const colRef = collection(firestore, `companies/${companyId}/purchaseOrders`);
    const order: Omit<PurchaseOrder, 'id'> = {
      supplierId: values.supplierId,
      supplierName: values.supplierName,
      items: values.items.map((item) => ({
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        quantity: item.quantity,
        unitCost: item.unitCost,
        received: false,
      })),
      status: 'borrador',
      totalCost,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      companyId,
    };
    await addDocumentNonBlocking(colRef, order);
    toast({ title: 'Orden creada', description: `Orden para ${values.supplierName} registrada.` });
    reset();
    setAddOpen(false);
  };

  const handleReceiveOrder = async (order: PurchaseOrder & { id: string }) => {
    if (!firestore) return;
    setReceivingId(order.id);
    try {
      // Update order status
      const orderDocRef = doc(firestore, `companies/${companyId}/purchaseOrders/${order.id}`);
      await updateDocumentNonBlocking(orderDocRef, {
        status: 'recibido',
        receivedAt: new Date().toISOString(),
      });

      // For each item: update ingredient stock + create stockMovement
      for (const item of order.items) {
        const ingredient = ingredients.find((i) => i.id === item.ingredientId);
        if (ingredient) {
          const newStock = (ingredient.currentStock ?? 0) + item.quantity;
          const ingredientDocRef = doc(
            firestore,
            `companies/${companyId}/ingredients/${item.ingredientId}`
          );
          await updateDocumentNonBlocking(ingredientDocRef, { currentStock: newStock });

          const movementsColRef = collection(
            firestore,
            `companies/${companyId}/stockMovements`
          );
          const movement: Omit<StockMovement, 'id'> = {
            ingredientId: item.ingredientId,
            ingredientName: item.ingredientName,
            type: 'entrada',
            quantity: item.quantity,
            reason: `Orden de compra #${order.id.slice(-6)}`,
            purchaseOrderId: order.id,
            createdBy: userId,
            timestamp: new Date().toISOString(),
            unitCost: item.unitCost,
            companyId,
          };
          await addDocumentNonBlocking(movementsColRef, movement);
        }
      }

      toast({
        title: 'Orden recibida',
        description: 'El stock fue actualizado correctamente.',
      });
    } finally {
      setReceivingId(null);
    }
  };

  const statusLabels: Record<string, string> = {
    borrador: 'Borrador',
    enviado: 'Enviado',
    recibido: 'Recibido',
  };

  const statusVariant: Record<string, 'outline' | 'secondary' | 'default'> = {
    borrador: 'outline',
    enviado: 'secondary',
    recibido: 'default',
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Órdenes de Compra</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Orden
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nueva Orden de Compra</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onCreateOrder)} className="space-y-4">
              {/* Supplier selector */}
              <div className="space-y-1">
                <Label>Proveedor</Label>
                <Select
                  value={watch('supplierId')}
                  onValueChange={(v) => {
                    const supplier = suppliers.find((s) => s.id === v);
                    setValue('supplierId', v);
                    setValue('supplierName', supplier?.name ?? '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.supplierId && (
                  <p className="text-xs text-destructive">{errors.supplierId.message}</p>
                )}
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Artículos</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      append({
                        ingredientId: '',
                        ingredientName: '',
                        quantity: 1,
                        unitCost: 0,
                      })
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Agregar artículo
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Agregue al menos un artículo a la orden.
                  </p>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                    {/* Ingredient selector */}
                    <div className="col-span-5">
                      <Select
                        value={watch(`items.${index}.ingredientId`)}
                        onValueChange={(v) => {
                          const ingredient = ingredients.find((i) => i.id === v);
                          setValue(`items.${index}.ingredientId`, v);
                          setValue(`items.${index}.ingredientName`, ingredient?.name ?? '');
                          setValue(`items.${index}.unitCost`, ingredient?.costPerUnit ?? 0);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ingrediente" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((ing) => (
                            <SelectItem key={ing.id} value={ing.id}>
                              {ing.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.items?.[index]?.ingredientId && (
                        <p className="text-xs text-destructive">
                          {errors.items[index]?.ingredientId?.message}
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="Cantidad"
                        {...register(`items.${index}.quantity`)}
                      />
                      {errors.items?.[index]?.quantity && (
                        <p className="text-xs text-destructive">
                          {errors.items[index]?.quantity?.message}
                        </p>
                      )}
                    </div>

                    {/* Unit cost */}
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Costo unit."
                        {...register(`items.${index}.unitCost`)}
                      />
                    </div>

                    <div className="col-span-1 flex justify-center pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => remove(index)}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}

                {errors.items && typeof errors.items === 'object' && 'message' in errors.items && (
                  <p className="text-xs text-destructive">{(errors.items as { message?: string }).message}</p>
                )}
              </div>

              {/* Total */}
              {fields.length > 0 && (
                <div className="flex justify-end">
                  <p className="text-sm font-semibold">
                    Total estimado: ${totalCost.toFixed(2)} MXN
                  </p>
                </div>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear Orden
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {purchaseOrders.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No hay órdenes de compra." />
      ) : (
        <div className="space-y-4">
          {purchaseOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-base">{order.supplierName}</CardTitle>
                    <CardDescription className="text-xs">
                      Creada: {formatInTimeZone(new Date(order.createdAt), TIME_ZONE, 'dd/MM/yyyy HH:mm')}
                      {order.receivedAt &&
                        ` · Recibida: ${formatInTimeZone(new Date(order.receivedAt), TIME_ZONE, 'dd/MM/yyyy HH:mm')}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[order.status] ?? 'outline'}>
                      {statusLabels[order.status] ?? order.status}
                    </Badge>
                    {order.status !== 'recibido' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={receivingId === order.id}
                        onClick={() => handleReceiveOrder(order)}
                      >
                        {receivingId === order.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Truck className="mr-1 h-3 w-3" />
                        )}
                        Marcar como Recibida
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Costo Unitario</TableHead>
                      <TableHead>Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item: PurchaseOrderItem, idx: number) => (
                      <TableRow key={`${item.ingredientId}-${idx}`}>
                        <TableCell>{item.ingredientName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>${item.unitCost.toFixed(2)}</TableCell>
                        <TableCell>${(item.quantity * item.unitCost).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-semibold">
                        Total
                      </TableCell>
                      <TableCell className="font-bold">${order.totalCost.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
