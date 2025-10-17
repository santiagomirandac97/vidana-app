
"use client";

import { useState, useEffect, useMemo, useRef, type ChangeEvent, type KeyboardEvent, type FC } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Download,
  PlusCircle,
  Upload,
  UserPlus,
  XCircle,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';


import { type Company, type Employee, type Consumption, COMPANIES } from '@/lib/types';
import { cn, exportToCsv, getTodayInMexicoCity, formatTimestamp } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/logo';

export default function HomePage() {
  const { firestore } = useFirebase();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('Inditex');
  
  const employeesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, `companies/${selectedCompanyId}/employees`)) : null
  , [firestore, selectedCompanyId]);
  const { data: employees, isLoading: isLoadingEmployees } = useCollection<Employee>(employeesQuery);

  const consumptionsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, `companies/${selectedCompanyId}/consumptions`), orderBy('timestamp', 'desc')) : null
  , [firestore, selectedCompanyId]);
  const { data: consumptions, isLoading: isLoadingConsumptions } = useCollection<Consumption>(consumptionsQuery);
  
  const recentConsumptionsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, `companies/${selectedCompanyId}/consumptions`), orderBy('timestamp', 'desc'), limit(10)) : null
  , [firestore, selectedCompanyId]);
  const { data: recentConsumptions } = useCollection<Consumption>(recentConsumptionsQuery);

  const [employeeNumber, setEmployeeNumber] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const [isQuickAddOpen, setQuickAddOpen] = useState(false);
  const [pendingEmployee, setPendingEmployee] = useState<{ number: string; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Seed companies if they don't exist
    if (firestore) {
      COMPANIES.forEach(company => {
        const companyRef = doc(firestore, 'companies', company.id);
        setDocumentNonBlocking(companyRef, { name: company.name }, { merge: true });
      });
    }
  }, [firestore]);


  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedCompanyId]);

  const resetInputAndFeedback = () => {
    setEmployeeNumber('');
    inputRef.current?.focus();
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleRegistration = () => {
    if (!employeeNumber.trim() || !firestore) return;

    const employee = employees?.find(e => e.employeeNumber === employeeNumber.trim());

    if (employee) {
      if (!employee.active) {
          setFeedback({ type: 'error', message: `Empleado Inactivo: ${employee.name} (#${employee.employeeNumber})` });
          resetInputAndFeedback();
          return;
      }

      const newConsumption: Omit<Consumption, 'id'> = {
        employeeId: employee.id!,
        employeeNumber: employee.employeeNumber,
        name: employee.name,
        companyId: selectedCompanyId,
        timestamp: new Date().toISOString(),
        voided: false,
      };

      const consumptionsCollection = collection(firestore, `companies/${selectedCompanyId}/consumptions`);
      addDocumentNonBlocking(consumptionsCollection, newConsumption);

      const today = getTodayInMexicoCity();
      const todayConsumptionsCount = (consumptions || [])
        .filter(c => c.employeeNumber === employee.employeeNumber && c.timestamp.startsWith(today) && !c.voided)
        .length + 1;
      
      const timePart = formatTimestamp(newConsumption.timestamp);

      setFeedback({
        type: 'success',
        message: `Acceso Registrado: ${employee.name} (#${employee.employeeNumber}) · ${employee.companyId} · ${timePart} · Registros de hoy: ${todayConsumptionsCount}`,
      });
    } else {
      setFeedback({
        type: 'warning',
        message: `Empleado desconocido #${employeeNumber}. ¿Activar rápidamente?`,
      });
      setPendingEmployee({ number: employeeNumber, name: '' });
      setQuickAddOpen(true);
    }
    resetInputAndFeedback();
  };

  const handleQuickActivate = (name: string) => {
    if (!pendingEmployee || !name.trim() || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Se requiere un nombre para la activación.' });
      return;
    }

    const newEmployee: Omit<Employee, 'id'> = {
      employeeNumber: pendingEmployee.number,
      name,
      companyId: selectedCompanyId,
      active: true,
    };

    const employeesCollection = collection(firestore, `companies/${selectedCompanyId}/employees`);
    addDocumentNonBlocking(employeesCollection, newEmployee).then(docRef => {
        const newConsumption: Omit<Consumption, 'id'> = {
            employeeId: docRef.id,
            employeeNumber: newEmployee.employeeNumber,
            name: newEmployee.name,
            companyId: selectedCompanyId,
            timestamp: new Date().toISOString(),
            voided: false,
        };
        const consumptionsCollection = collection(firestore, `companies/${selectedCompanyId}/consumptions`);
        addDocumentNonBlocking(consumptionsCollection, newConsumption);
        
        const timePart = formatTimestamp(newConsumption.timestamp);

        setFeedback({
            type: 'success',
            message: `Activado y Registrado: ${newEmployee.name} (#${newEmployee.employeeNumber}) · ${newEmployee.companyId} · ${timePart} · Registros de hoy: 1`,
        });
    });

    setQuickAddOpen(false);
    setPendingEmployee(null);
    resetInputAndFeedback();
  };
  

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRegistration();
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <header className="flex justify-between items-center mb-8">
        <Logo />
        <Select value={selectedCompanyId} onValueChange={(v) => setSelectedCompanyId(v)}>
          <SelectTrigger className="w-[180px] text-lg h-12">
            <SelectValue placeholder="Seleccionar Empresa" />
          </SelectTrigger>
          <SelectContent>
            {COMPANIES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Registrar Acceso a Comida</CardTitle>
              <CardDescription>Ingrese el número de empleado y presione Enter. Optimizado para escáneres.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  ref={inputRef}
                  autoFocus
                  value={employeeNumber}
                  onChange={(e) => setEmployeeNumber(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Número de Empleado para ${selectedCompanyId}`}
                  className="text-2xl h-16 flex-grow"
                />
                <Button onClick={handleRegistration} className="h-16 text-lg">
                  <ChevronDown className="h-6 w-6 mr-2 rotate-90" /> Enviar
                </Button>
              </div>
              {feedback && (
                <div className={cn("mt-4 p-3 rounded-md flex items-center gap-2 text-lg", {
                  'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300': feedback.type === 'success',
                  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300': feedback.type === 'warning',
                  'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300': feedback.type === 'error',
                })}>
                  {feedback.type === 'success' && <CheckCircle className="h-6 w-6" />}
                  {feedback.type === 'warning' && <AlertCircle className="h-6 w-6" />}
                  {feedback.type === 'error' && <XCircle className="h-6 w-6" />}
                  <span className="font-medium">{feedback.message}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Últimos 10 Consumos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead># Empleado</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recentConsumptions || []).map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.employeeNumber}</TableCell>
                      <TableCell>{c.companyId}</TableCell>
                      <TableCell>{formatTimestamp(c.timestamp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1">
          <AdminPanel 
            employees={employees || []} 
            consumptions={consumptions || []}
            selectedCompanyId={selectedCompanyId} 
          />
        </div>
      </main>

      <QuickAddDialog 
        isOpen={isQuickAddOpen}
        setIsOpen={setQuickAddOpen}
        onActivate={handleQuickActivate}
        employeeNumber={pendingEmployee?.number ?? ''}
        companyId={selectedCompanyId}
      />
    </div>
  );
}

// Sub-components
interface AdminPanelProps {
  employees: Employee[];
  consumptions: Consumption[];
  selectedCompanyId: string;
}

const AdminPanel: FC<AdminPanelProps> = ({ employees, consumptions, selectedCompanyId }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { firestore } = useFirebase();

  const [date, setDate] = useState<DateRange | undefined>();
  const [reportCompanyId, setReportCompanyId] = useState<string>('Inditex');

  useEffect(() => {
    setReportCompanyId(selectedCompanyId);
  }, [selectedCompanyId]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        const header = lines.shift()?.split(',').map(h => h.trim().toLowerCase()) || [];
        
        const requiredHeaders = ['employeenumber', 'name', 'active'];
        if (!header.includes('employeenumber') || !header.includes('name') || !header.includes('active')) {
          throw new Error(`Encabezado de CSV inválido. Debe incluir: employeeNumber, name, active`);
        }
        
        const employeeNumberIndex = header.indexOf('employeenumber');
        const nameIndex = header.indexOf('name');
        const activeIndex = header.indexOf('active');

        const newEmployees = lines.map(line => {
          const values = line.split(',');
          return {
            employeeNumber: values[employeeNumberIndex],
            name: values[nameIndex],
            active: String(values[activeIndex]).toLowerCase() === 'true',
            companyId: selectedCompanyId,
          } as Omit<Employee, 'id'>;
        });

        let addedCount = 0;
        let updatedCount = 0;

        const employeesCollection = collection(firestore, `companies/${selectedCompanyId}/employees`);

        newEmployees.forEach(async newEmp => {
            const q = query(employeesCollection, where('employeeNumber', '==', newEmp.employeeNumber));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docToUpdate = querySnapshot.docs[0];
                updateDocumentNonBlocking(docToUpdate.ref, newEmp);
                updatedCount++;
            } else {
                addDocumentNonBlocking(employeesCollection, newEmp);
                addedCount++;
            }
        });


        toast({ title: 'Importación Exitosa', description: `${addedCount} empleados agregados, ${updatedCount} actualizados para ${selectedCompanyId}.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Falló la Importación', description: error.message });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };
  
  const handleExportEmployees = (companyId: string) => {
    const companyEmployees = employees;
    const headers = ['employeeNumber', 'name', 'companyId', 'department', 'email', 'active'];
    const rows = [
      headers,
      ...companyEmployees.map(e => [e.employeeNumber, e.name, e.companyId, e.department || '', e.email || '', e.active])
    ];
    exportToCsv(`${companyId}_empleados_${new Date().toISOString().split('T')[0]}.csv`, rows);
  }

  const handleExportConsumptions = () => {
    if (!date?.from || !date?.to) {
        toast({variant: 'destructive', title: 'Por favor seleccione un rango de fechas.'});
        return;
    }
    const from = date.from.getTime();
    const to = date.to.getTime() + (24 * 60 * 60 * 1000 - 1); // include full end day

    const filteredConsumptions = consumptions.filter(c => {
        const c_time = new Date(c.timestamp).getTime();
        return c_time >= from && c_time <= to;
    });

    const headers = ['id', 'employeeNumber', 'name', 'companyId', 'timestamp', 'voided'];
    const rows = [
        headers,
        ...filteredConsumptions.map(c => [c.id, c.employeeNumber, c.name, c.companyId, c.timestamp, c.voided])
    ];

    const uniqueEmployees = new Set(filteredConsumptions.map(c => c.employeeNumber)).size;

    exportToCsv(`${reportCompanyId}_consumos_${format(date.from, "yyyy-MM-dd")}_a_${format(date.to, "yyyy-MM-dd")}.csv`, rows);
    toast({ title: 'Reporte Generado', description: `Total: ${filteredConsumptions.length} consumos de ${uniqueEmployees} empleados únicos.` });
  }

  const handleAddEmployee = (employee: Omit<Employee, 'id'>) => {
    if(!firestore) return;
    const employeesCollection = collection(firestore, `companies/${employee.companyId}/employees`);
    addDocumentNonBlocking(employeesCollection, employee);
    toast({ title: 'Empleado Añadido', description: `${employee.name} añadido a ${employee.companyId}.` });
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Panel de Administración</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="employees">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="employees">Empleados</TabsTrigger>
            <TabsTrigger value="consumptions">Reportes</TabsTrigger>
          </TabsList>
          <TabsContent value="employees" className="space-y-4 pt-4">
            <h3 className="font-semibold">Importar Empleados (CSV) para {selectedCompanyId}</h3>
            <Button variant="outline" className="w-full" onClick={() => { fileInputRef.current?.click();}}>
              <Upload className="mr-2 h-4 w-4" /> Importar para {selectedCompanyId}
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />

            <h3 className="font-semibold">Exportar Empleados de {selectedCompanyId}</h3>
            <Button variant="outline" className="w-full" onClick={() => handleExportEmployees(selectedCompanyId)}>
              <Download className="mr-2 h-4 w-4" /> Exportar para {selectedCompanyId}
            </Button>
             <h3 className="font-semibold">Añadir Rápido Empleado</h3>
              <QuickAddForm onAdd={handleAddEmployee} />
          </TabsContent>
          <TabsContent value="consumptions" className="space-y-4 pt-4">
            <h3 className="font-semibold">Exportar Consumos</h3>
            <div className="space-y-2">
              <label>Empresa</label>
              <Select value={reportCompanyId} onValueChange={(v) => setReportCompanyId(v)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{COMPANIES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
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
                    numberOfMonths={2}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button className="w-full" onClick={handleExportConsumptions}><Download className="mr-2 h-4 w-4"/> Exportar Reporte</Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}


interface QuickAddDialogProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    onActivate: (name: string) => void;
    employeeNumber: string;
    companyId: string;
}

const QuickAddDialog: FC<QuickAddDialogProps> = ({ isOpen, setIsOpen, onActivate, employeeNumber, companyId }) => {
    const [name, setName] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName('');
        }
    }, [isOpen]);

    const handleActivateClick = () => {
        onActivate(name);
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Activación Rápida de Empleado</DialogTitle>
                    <CardDescription>Este empleado no está en la base de datos. Por favor, proporcione un nombre para activar.</CardDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label>Empresa</label>
                        <Input value={companyId} readOnly disabled />
                    </div>
                    <div className="space-y-2">
                        <label>Número de Empleado</label>
                        <Input value={employeeNumber} readOnly disabled />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="quick-add-name">Nombre Completo</label>
                        <Input id="quick-add-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej., Juan Pérez" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleActivateClick()} />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                    <Button onClick={handleActivateClick}><UserPlus className="mr-2 h-4 w-4"/> Activar y Registrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const QuickAddForm: FC<{ onAdd: (employee: Omit<Employee, 'id'>) => void }> = ({ onAdd }) => {
    const [open, setOpen] = useState(false);
    const [number, setNumber] = useState('');
    const [name, setName] = useState('');
    const [companyId, setCompanyId] = useState<string>('Inditex');
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!number || !name) {
            toast({ variant: "destructive", title: "Error", description: "Se requiere número y nombre." });
            return;
        }
        onAdd({
            employeeNumber: number,
            name,
            companyId,
            active: true
        });
        setNumber('');
        setName('');
        setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full"><PlusCircle className="mr-2 h-4 w-4"/> Añadir Manualmente</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Añadir Rápido Empleado</DialogTitle></DialogHeader>
                 <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label>Empresa</label>
                        <Select value={companyId} onValueChange={v => setCompanyId(v)}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>{COMPANIES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label>Número de Empleado</label>
                        <Input value={number} onChange={e => setNumber(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <label>Nombre Completo</label>
                        <Input value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
                      <Button type="submit">Añadir Empleado</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
