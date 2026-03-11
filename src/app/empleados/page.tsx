'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { doc, collection, query, where, orderBy, addDoc, updateDoc, deleteField, doc as firestoreDoc } from 'firebase/firestore';
import { type UserProfile, type Employee, type Company, type Bonus } from '@/lib/types';
import { AppShell, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ShieldAlert, Plus, MoreVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EmpleadosPage() {
  // Auth
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  // User profile / admin check
  const userProfileRef = useMemoFirebase(
    () => firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'admin';

  // Companies
  const companiesRef = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'companies')) : null,
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesRef);

  // Selected company
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  useEffect(() => {
    if (!selectedCompanyId && companies && companies.length > 0) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);
  const activeCompanyId = selectedCompanyId || companies?.[0]?.id || '';

  // Employees for selected company
  const employeesRef = useMemoFirebase(
    () => firestore && activeCompanyId
      ? query(
          collection(firestore, `companies/${activeCompanyId}/staff`),
          where('voided', '!=', true),
          orderBy('voided'),
          orderBy('name')
        )
      : null,
    [firestore, activeCompanyId]
  );
  const { data: employees, isLoading: employeesLoading } = useCollection<Employee>(employeesRef);

  // Employee dialog state
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empName, setEmpName] = useState('');
  const [empNumber, setEmpNumber] = useState('');
  const [empPosition, setEmpPosition] = useState('');
  const [empSalary, setEmpSalary] = useState('');

  // Bonus dialog state
  const [bonusEmployee, setBonusEmployee] = useState<Employee | null>(null);
  const [showBonusDialog, setShowBonusDialog] = useState(false);
  const [bonusDesc, setBonusDesc] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusRecurring, setBonusRecurring] = useState(true);
  const [bonusAppliesTo, setBonusAppliesTo] = useState('');

  // Bonuses for the employee whose bonus dialog is open
  const bonusesRef = useMemoFirebase(
    () => firestore && bonusEmployee?.id && activeCompanyId
      ? query(
          collection(firestore, `companies/${activeCompanyId}/staff/${bonusEmployee.id}/bonuses`),
          where('active', '==', true)
        )
      : null,
    [firestore, bonusEmployee?.id, activeCompanyId]
  );
  const { data: bonuses } = useCollection<Bonus>(bonusesRef);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Employee CRUD
  const openAddEmployee = () => {
    setEditingEmployee(null);
    setEmpName('');
    setEmpNumber('');
    setEmpPosition('');
    setEmpSalary('');
    setShowEmployeeDialog(true);
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpName(emp.name);
    setEmpNumber(emp.employeeNumber);
    setEmpPosition(emp.position || '');
    setEmpSalary(emp.salaryPerQuincena?.toString() || '');
    setShowEmployeeDialog(true);
  };

  const handleSaveEmployee = async () => {
    if (!firestore || !activeCompanyId || !empName.trim() || !empNumber.trim()) return;
    const data = {
      name: empName.trim(),
      employeeNumber: empNumber.trim(),
      position: empPosition.trim(),
      salaryPerQuincena: empSalary ? parseFloat(empSalary) : 0,
      companyId: activeCompanyId,
    };
    try {
      if (editingEmployee?.id) {
        await updateDoc(
          firestoreDoc(firestore, `companies/${activeCompanyId}/staff/${editingEmployee.id}`),
          data
        );
        toast({ title: 'Empleado actualizado.' });
      } else {
        await addDoc(
          collection(firestore, `companies/${activeCompanyId}/staff`),
          { ...data, active: true, voided: false, startDate: new Date().toISOString().slice(0, 10) }
        );
        toast({ title: 'Empleado registrado.' });
      }
      setShowEmployeeDialog(false);
    } catch {
      toast({ title: 'Error al guardar.', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    if (!firestore || !activeCompanyId || !emp.id) return;
    try {
      if (emp.active) {
        // Deactivating — set endDate
        await updateDoc(
          firestoreDoc(firestore, `companies/${activeCompanyId}/staff/${emp.id}`),
          { active: false, endDate: new Date().toISOString().slice(0, 10) }
        );
      } else {
        // Reactivating — remove endDate
        await updateDoc(
          firestoreDoc(firestore, `companies/${activeCompanyId}/staff/${emp.id}`),
          { active: true, endDate: deleteField() }
        );
      }
    } catch {
      toast({ title: 'Error al cambiar estado.', variant: 'destructive' });
    }
  };

  // Bonus management
  const openBonusDialog = (emp: Employee) => {
    setBonusEmployee(emp);
    setBonusDesc('');
    setBonusAmount('');
    setBonusRecurring(true);
    setBonusAppliesTo('');
    setShowBonusDialog(true);
  };

  const handleAddBonus = async () => {
    if (!firestore || !bonusEmployee?.id || !activeCompanyId || !bonusDesc.trim() || !bonusAmount) return;
    if (!bonusRecurring && bonusAppliesTo) {
      const day = parseInt(bonusAppliesTo.split('-')[2], 10);
      if (day !== 15 && day !== 30) {
        toast({ title: 'La fecha debe ser el día 15 o 30 del mes.', variant: 'destructive' });
        return;
      }
    }
    try {
      await addDoc(
        collection(firestore, `companies/${activeCompanyId}/staff/${bonusEmployee.id}/bonuses`),
        {
          employeeId: bonusEmployee.id,
          companyId: activeCompanyId,
          description: bonusDesc.trim(),
          amount: parseFloat(bonusAmount),
          isRecurring: bonusRecurring,
          appliesTo: bonusRecurring ? undefined : bonusAppliesTo,
          active: true,
          createdBy: user!.uid,
        }
      );
      setBonusDesc('');
      setBonusAmount('');
      toast({ title: 'Bono registrado.' });
    } catch {
      toast({ title: 'Error al guardar bono.', variant: 'destructive' });
    }
  };

  const handleDeactivateBonus = async (bonus: Bonus) => {
    if (!firestore || !bonusEmployee?.id || !activeCompanyId || !bonus.id) return;
    try {
      await updateDoc(
        firestoreDoc(firestore, `companies/${activeCompanyId}/staff/${bonusEmployee.id}/bonuses/${bonus.id}`),
        { active: false }
      );
    } catch {
      toast({ title: 'Error al quitar bono.', variant: 'destructive' });
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────────

  if (!userLoading && !user) return null;

  if (userLoading || profileLoading || companiesLoading) {
    return (
      <AppShell>
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-8" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="flex h-full w-full items-center justify-center">
          <Card className="w-full max-w-sm mx-4 text-center">
            <CardHeader>
              <CardTitle className="flex flex-col items-center gap-2">
                <ShieldAlert className="h-12 w-12 text-destructive" />
                Acceso Denegado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/selection')} className="w-full">Volver</Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  // ── Main admin view ────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <PageHeader
          title="Empleados"
          subtitle="Gestión de nómina por cocina"
          action={
            <div className="flex items-center gap-2">
              <Select value={activeCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Seleccionar cocina" />
                </SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-sm gap-1" onClick={openAddEmployee}>
                <Plus className="h-3.5 w-3.5" /> Nuevo Empleado
              </Button>
            </div>
          }
        />

        {/* Employee list */}
        {employeesLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        )}

        {!employeesLoading && (!employees || employees.length === 0) && (
          <Card className="text-center py-12">
            <CardContent className="text-muted-foreground">
              No hay empleados registrados para esta cocina.
            </CardContent>
          </Card>
        )}

        {!employeesLoading && employees && employees.length > 0 && (
          <div className="space-y-3">
            {employees.map(emp => (
              <Card
                key={emp.id}
                className={`shadow-card hover:shadow-card-hover transition-shadow${!emp.active ? ' opacity-60' : ''}`}
              >
                <CardHeader className="pb-1 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{emp.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      #{emp.employeeNumber}{emp.position ? ` · ${emp.position}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={emp.active ? 'default' : 'secondary'}>
                      {emp.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditEmployee(emp)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openBonusDialog(emp)}>Bonos</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleToggleActive(emp)}
                        >
                          {emp.active ? 'Desactivar' : 'Activar'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pt-1">
                  <p className="text-sm text-muted-foreground">
                    Salario por quincena:{' '}
                    <span className="font-mono font-semibold text-foreground">
                      {emp.salaryPerQuincena != null ? fmt(emp.salaryPerQuincena) : '—'}
                    </span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Employee Dialog */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="emp-name">Nombre completo</Label>
              <Input id="emp-name" value={empName} onChange={e => setEmpName(e.target.value)} placeholder="Ej: Juan López" />
            </div>
            <div>
              <Label htmlFor="emp-number">Número de empleado</Label>
              <Input id="emp-number" value={empNumber} onChange={e => setEmpNumber(e.target.value)} placeholder="Ej: 001" />
            </div>
            <div>
              <Label htmlFor="emp-position">Puesto (opcional)</Label>
              <Input id="emp-position" value={empPosition} onChange={e => setEmpPosition(e.target.value)} placeholder="Ej: Cocinero" />
            </div>
            <div>
              <Label htmlFor="emp-salary">Salario por quincena (MXN)</Label>
              <Input
                id="emp-salary"
                type="number" min="0" step="0.01"
                value={empSalary}
                onChange={e => setEmpSalary(e.target.value)}
                placeholder="Ej: 5000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveEmployee} disabled={!empName.trim() || !empNumber.trim()}>
              {editingEmployee ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bonus Management Dialog */}
      <Dialog open={showBonusDialog} onOpenChange={setShowBonusDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bonos — {bonusEmployee?.name}</DialogTitle>
          </DialogHeader>

          {bonuses && bonuses.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-sm font-medium">Bonos activos</p>
              {bonuses.map(b => (
                <div key={b.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                  <div>
                    <span className="font-medium">{b.description}</span>
                    {' · '}
                    <span className="font-mono">{fmt(b.amount)}</span>
                    {' · '}
                    <Badge variant={b.isRecurring ? 'default' : 'secondary'} className="text-xs">
                      {b.isRecurring ? 'Recurrente' : `Una vez · ${b.appliesTo}`}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    className="text-destructive h-7 text-xs"
                    onClick={() => handleDeactivateBonus(b)}
                  >
                    Quitar
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Agregar bono</p>
            <div>
              <Label htmlFor="bonus-desc">Descripción</Label>
              <Input id="bonus-desc" value={bonusDesc} onChange={e => setBonusDesc(e.target.value)} placeholder="Ej: Bono puntualidad" />
            </div>
            <div>
              <Label htmlFor="bonus-amount">Monto (MXN)</Label>
              <Input
                id="bonus-amount"
                type="number" min="0" step="0.01"
                value={bonusAmount}
                onChange={e => setBonusAmount(e.target.value)}
                placeholder="Ej: 500"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={bonusRecurring} onCheckedChange={setBonusRecurring} id="recurring-switch" />
              <Label htmlFor="recurring-switch">Recurrente (cada quincena)</Label>
            </div>
            {!bonusRecurring && (
              <div>
                <Label htmlFor="bonus-applies-to">Aplica a quincena (fecha)</Label>
                <Input id="bonus-applies-to" type="date" value={bonusAppliesTo} onChange={e => setBonusAppliesTo(e.target.value)} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBonusDialog(false)}>Cerrar</Button>
            <Button
              onClick={handleAddBonus}
              disabled={!bonusDesc.trim() || !bonusAmount || (!bonusRecurring && !bonusAppliesTo)}
            >
              Agregar bono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
