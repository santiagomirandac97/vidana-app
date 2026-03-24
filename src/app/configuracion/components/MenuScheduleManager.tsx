'use client';

import { useState, useCallback, type FC } from 'react';
import { useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { type MenuSchedule, type MenuItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, Clock } from 'lucide-react';

const DAY_LABELS = [
    { value: 1, label: 'L' },
    { value: 2, label: 'M' },
    { value: 3, label: 'Mi' },
    { value: 4, label: 'J' },
    { value: 5, label: 'V' },
    { value: 6, label: 'S' },
    { value: 0, label: 'D' },
];

const DAY_FULL_NAMES: Record<number, string> = {
    0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Jue', 5: 'Vie', 6: 'Sab',
};

interface FormState {
    name: string;
    menuItemIds: string[];
    active: boolean;
    hasTimeRestriction: boolean;
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
}

const emptyForm: FormState = {
    name: '',
    menuItemIds: [],
    active: true,
    hasTimeRestriction: false,
    startTime: '08:00',
    endTime: '17:00',
    daysOfWeek: [],
};

export const MenuScheduleManager: FC<{ companyId: string }> = ({ companyId }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Fetch menu schedules
    const schedulesRef = useMemoFirebase(
        () => firestore && companyId
            ? query(collection(firestore, `companies/${companyId}/menuSchedules`), orderBy('name'))
            : null,
        [firestore, companyId]
    );
    const { data: schedules, isLoading: schedulesLoading } = useCollection<MenuSchedule>(schedulesRef);

    // Fetch menu items for the multi-select
    const menuItemsRef = useMemoFirebase(
        () => firestore && companyId
            ? query(collection(firestore, `companies/${companyId}/menuItems`), orderBy('name'))
            : null,
        [firestore, companyId]
    );
    const { data: menuItems } = useCollection<MenuItem>(menuItemsRef);

    const openCreateDialog = useCallback(() => {
        setEditingId(null);
        setForm(emptyForm);
        setDialogOpen(true);
    }, []);

    const openEditDialog = useCallback((schedule: MenuSchedule) => {
        setEditingId(schedule.id ?? null);
        setForm({
            name: schedule.name,
            menuItemIds: schedule.menuItemIds ?? [],
            active: schedule.active,
            hasTimeRestriction: !!schedule.timeRestriction,
            startTime: schedule.timeRestriction?.startTime ?? '08:00',
            endTime: schedule.timeRestriction?.endTime ?? '17:00',
            daysOfWeek: schedule.daysOfWeek ?? [],
        });
        setDialogOpen(true);
    }, []);

    const toggleMenuItem = useCallback((itemId: string) => {
        setForm(prev => ({
            ...prev,
            menuItemIds: prev.menuItemIds.includes(itemId)
                ? prev.menuItemIds.filter(id => id !== itemId)
                : [...prev.menuItemIds, itemId],
        }));
    }, []);

    const toggleDay = useCallback((day: number) => {
        setForm(prev => ({
            ...prev,
            daysOfWeek: prev.daysOfWeek.includes(day)
                ? prev.daysOfWeek.filter(d => d !== day)
                : [...prev.daysOfWeek, day],
        }));
    }, []);

    const handleSave = useCallback(async () => {
        if (!firestore || !companyId) return;
        if (!form.name.trim()) {
            toast({ variant: 'destructive', title: 'Nombre requerido', description: 'Ingresa un nombre para el horario.' });
            return;
        }
        setSaving(true);
        try {
            const data: Omit<MenuSchedule, 'id'> = {
                companyId,
                name: form.name.trim(),
                menuItemIds: form.menuItemIds,
                active: form.active,
                ...(form.hasTimeRestriction
                    ? { timeRestriction: { startTime: form.startTime, endTime: form.endTime } }
                    : {}),
                ...(form.daysOfWeek.length > 0 ? { daysOfWeek: form.daysOfWeek } : {}),
            };

            if (editingId) {
                const scheduleRef = doc(firestore, `companies/${companyId}/menuSchedules/${editingId}`);
                // When editing, explicitly clear optional fields if not set
                await updateDoc(scheduleRef, {
                    ...data,
                    timeRestriction: form.hasTimeRestriction
                        ? { startTime: form.startTime, endTime: form.endTime }
                        : deleteField(),
                    daysOfWeek: form.daysOfWeek.length > 0 ? form.daysOfWeek : deleteField(),
                });
                toast({ title: 'Horario actualizado', description: `"${data.name}" fue actualizado.` });
            } else {
                await addDoc(collection(firestore, `companies/${companyId}/menuSchedules`), data);
                toast({ title: 'Horario creado', description: `"${data.name}" fue agregado.` });
            }

            setDialogOpen(false);
            setEditingId(null);
            setForm(emptyForm);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error al guardar', description: err.message });
        } finally {
            setSaving(false);
        }
    }, [firestore, companyId, form, editingId, toast]);

    const handleDelete = useCallback(async (scheduleId: string) => {
        if (!firestore || !companyId) return;
        setDeletingId(scheduleId);
        try {
            await deleteDoc(doc(firestore, `companies/${companyId}/menuSchedules/${scheduleId}`));
            toast({ title: 'Horario eliminado' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error al eliminar', description: err.message });
        } finally {
            setDeletingId(null);
        }
    }, [firestore, companyId, toast]);

    const handleToggleActive = useCallback(async (schedule: MenuSchedule) => {
        if (!firestore || !companyId || !schedule.id) return;
        try {
            const scheduleRef = doc(firestore, `companies/${companyId}/menuSchedules/${schedule.id}`);
            await updateDoc(scheduleRef, { active: !schedule.active });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    }, [firestore, companyId, toast]);

    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    return (
        <Card className="rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Horarios de Menu</CardTitle>
                <Button size="sm" onClick={openCreateDialog}>
                    <Plus className="mr-1 h-4 w-4" />
                    Agregar Menu
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {schedulesLoading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!schedulesLoading && (!schedules || schedules.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                        No hay horarios de menu configurados.
                    </p>
                )}

                {schedules && schedules.length > 0 && (
                    <div className="grid gap-3">
                        {schedules.map(schedule => (
                            <div
                                key={schedule.id}
                                className="flex items-center justify-between rounded-xl border p-4 bg-card"
                            >
                                <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium">{schedule.name}</span>
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                schedule.active
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                            }`}
                                        >
                                            {schedule.active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                        {schedule.timeRestriction && (
                                            <span className="inline-flex items-center gap-1">
                                                <Clock className="h-3.5 w-3.5" />
                                                {schedule.timeRestriction.startTime} - {schedule.timeRestriction.endTime}
                                            </span>
                                        )}
                                        {schedule.daysOfWeek && schedule.daysOfWeek.length > 0 ? (
                                            <span>
                                                {schedule.daysOfWeek
                                                    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
                                                    .map(d => DAY_FULL_NAMES[d])
                                                    .join(', ')}
                                            </span>
                                        ) : (
                                            <span>Todos los dias</span>
                                        )}
                                        <span>{schedule.menuItemIds?.length ?? 0} platillos</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4 shrink-0">
                                    <Switch
                                        checked={schedule.active}
                                        onCheckedChange={() => handleToggleActive(schedule)}
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(schedule)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    {confirmDeleteId === schedule.id ? (
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                disabled={deletingId === schedule.id}
                                                onClick={() => {
                                                    handleDelete(schedule.id!);
                                                    setConfirmDeleteId(null);
                                                }}
                                            >
                                                {deletingId === schedule.id
                                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                                    : 'Si'}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setConfirmDeleteId(null)}
                                            >
                                                No
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setConfirmDeleteId(schedule.id!)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Editar Horario' : 'Agregar Menu'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 py-2">
                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="scheduleName">Nombre</Label>
                            <Input
                                id="scheduleName"
                                placeholder="Ej. Desayuno, Comida, Snacks"
                                value={form.name}
                                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>

                        {/* Active toggle */}
                        <div className="flex items-center justify-between">
                            <Label htmlFor="scheduleActive">Activo</Label>
                            <Switch
                                id="scheduleActive"
                                checked={form.active}
                                onCheckedChange={checked => setForm(prev => ({ ...prev, active: checked }))}
                            />
                        </div>

                        {/* Time restriction */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="hasTimeRestriction">Restriccion de horario</Label>
                                <Switch
                                    id="hasTimeRestriction"
                                    checked={form.hasTimeRestriction}
                                    onCheckedChange={checked => setForm(prev => ({ ...prev, hasTimeRestriction: checked }))}
                                />
                            </div>
                            {form.hasTimeRestriction && (
                                <div className="flex items-center gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Inicio</Label>
                                        <Input
                                            type="time"
                                            value={form.startTime}
                                            onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                                            className="w-32"
                                        />
                                    </div>
                                    <span className="mt-5 text-muted-foreground">-</span>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Fin</Label>
                                        <Input
                                            type="time"
                                            value={form.endTime}
                                            onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                                            className="w-32"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Days of week */}
                        <div className="space-y-2">
                            <Label>Dias de la semana</Label>
                            <p className="text-xs text-muted-foreground">Sin seleccion = todos los dias</p>
                            <div className="flex gap-2">
                                {DAY_LABELS.map(day => (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() => toggleDay(day.value)}
                                        className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${
                                            form.daysOfWeek.includes(day.value)
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        }`}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Menu items multi-select */}
                        <div className="space-y-2">
                            <Label>Platillos</Label>
                            {menuItems && menuItems.length > 0 ? (
                                <div className="max-h-48 overflow-y-auto rounded-lg border p-3 space-y-2">
                                    {menuItems.map(item => (
                                        <div key={item.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`mi-${item.id}`}
                                                checked={form.menuItemIds.includes(item.id)}
                                                onCheckedChange={() => toggleMenuItem(item.id)}
                                            />
                                            <Label htmlFor={`mi-${item.id}`} className="font-normal cursor-pointer text-sm">
                                                {item.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No hay platillos registrados.</p>
                            )}
                            {form.menuItemIds.length > 0 && (
                                <p className="text-xs text-muted-foreground">{form.menuItemIds.length} seleccionado(s)</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingId ? 'Guardar Cambios' : 'Crear Horario'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};
