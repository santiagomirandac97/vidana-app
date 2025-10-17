
"use client";

import { useState, useEffect, useMemo, useRef, type ChangeEvent, type KeyboardEvent, type FC } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Download,
  PlusCircle,
  Trash2,
  Upload,
  UserPlus,
  XCircle,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

import useLocalStorage from '@/hooks/use-local-storage';
import { type Company, type Employee, type Consumption, COMPANIES, type EmployeesData, type ConsumptionsData } from '@/lib/types';
import { cn, exportToCsv, generateId, getTodayInMexicoCity, formatTimestamp } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/logo';

const SEED_EMPLOYEES: EmployeesData = {
  Inditex: [
    { employee_number: '1001', name: 'Ana Garcia', company: 'Inditex', active: true },
    { employee_number: '1002', name: 'Benito Juarez', company: 'Inditex', active: true },
    { employee_number: '1003', name: 'Carla Rossi', company: 'Inditex', active: true },
  ],
  'Grupo Axo': [
    { employee_number: '2001', name: 'David Smith', company: 'Grupo Axo', active: true },
    { employee_number: '2002', name: 'Elena Petrova', company: 'Grupo Axo', active: true },
    { employee_number: '2003', name: 'Frank Miller', company: 'Grupo Axo', active: true },
  ],
};

const INITIAL_EMPLOYEES: EmployeesData = { Inditex: [], 'Grupo Axo': [] };
const INITIAL_CONSUMPTIONS: ConsumptionsData = { Inditex: [], 'Grupo Axo': [] };

export default function HomePage() {
  const [employees, setEmployees] = useLocalStorage<EmployeesData>('RGSTR_EMPLOYEES', INITIAL_EMPLOYEES);
  const [consumptions, setConsumptions] = useLocalStorage<ConsumptionsData>('RGSTR_CONSUMPTIONS', INITIAL_CONSUMPTIONS);

  const [selectedCompany, setSelectedCompany] = useState<Company>('Inditex');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const [isQuickAddOpen, setQuickAddOpen] = useState(false);
  const [pendingEmployee, setPendingEmployee] = useState<{ number: string; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Seed data if local storage is empty
    const isSeeded = localStorage.getItem('RGSTR_SEEDED');
    if (!isSeeded) {
      setEmployees(SEED_EMPLOYEES);
      localStorage.setItem('RGSTR_SEEDED', 'true');
    }
  }, [setEmployees]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedCompany]);

  const recentConsumptions = useMemo(() => {
    const allConsumptions = [...consumptions.Inditex, ...consumptions['Grupo Axo']];
    return allConsumptions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
  }, [consumptions]);

  const resetInputAndFeedback = () => {
    setEmployeeNumber('');
    inputRef.current?.focus();
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleRegistration = () => {
    if (!employeeNumber.trim()) return;

    const companyEmployees = employees[selectedCompany];
    const employee = companyEmployees.find(e => e.employee_number === employeeNumber.trim());

    if (employee) {
      if (!employee.active) {
          setFeedback({ type: 'error', message: `Empleado Inactivo: ${employee.name} (#${employee.employee_number})` });
          resetInputAndFeedback();
          return;
      }

      const newConsumption: Consumption = {
        id: generateId(),
        employee_number: employee.employee_number,
        name: employee.name,
        company: selectedCompany,
        timestamp: new Date().toISOString(),
        voided: false,
      };

      setConsumptions(prev => ({
        ...prev,
        [selectedCompany]: [newConsumption, ...prev[selectedCompany]],
      }));

      const today = getTodayInMexicoCity();
      const todayConsumptionsCount = consumptions[selectedCompany]
        .filter(c => c.employee_number === employee.employee_number && c.timestamp.startsWith(today) && !c.voided)
        .length + 1;
      
      const timePart = formatTimestamp(newConsumption.timestamp);

      setFeedback({
        type: 'success',
        message: `Acceso Registrado: ${employee.name} (#${employee.employee_number}) · ${employee.company} · ${timePart} · Registros de hoy: ${todayConsumptionsCount}`,
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
    if (!pendingEmployee || !name.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Se requiere un nombre para la activación.' });
      return;
    }

    const newEmployee: Employee = {
      employee_number: pendingEmployee.number,
      name,
      company: selectedCompany,
      active: true,
    };
    
    setEmployees(prev => ({
      ...prev,
      [selectedCompany]: [...prev[selectedCompany], newEmployee],
    }));

    const newConsumption: Consumption = {
      id: generateId(),
      employee_number: newEmployee.employee_number,
      name: newEmployee.name,
      company: selectedCompany,
      timestamp: new Date().toISOString(),
      voided: false,
    };

    setConsumptions(prev => ({
      ...prev,
      [selectedCompany]: [newConsumption, ...prev[selectedCompany]],
    }));
    
    const timePart = formatTimestamp(newConsumption.timestamp);

    setFeedback({
      type: 'success',
      message: `Activado y Registrado: ${newEmployee.name} (#${newEmployee.employee_number}) · ${newEmployee.company} · ${timePart} · Registros de hoy: 1`,
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
        <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v as Company)}>
          <SelectTrigger className="w-[180px] text-lg h-12">
            <SelectValue placeholder="Seleccionar Empresa" />
          </SelectTrigger>
          <SelectContent>
            {COMPANIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                  placeholder={`Número de Empleado para ${selectedCompany}`}
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
                  {recentConsumptions.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.employee_number}</TableCell>
                      <TableCell>{c.company}</TableCell>
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
            employees={employees} 
            setEmployees={setEmployees} 
            consumptions={consumptions} 
            setConsumptions={setConsumptions}
            selectedCompany={selectedCompany} 
          />
        </div>
      </main>

      <QuickAddDialog 
        isOpen={isQuickAddOpen}
        setIsOpen={setQuickAddOpen}
        onActivate={handleQuickActivate}
        employeeNumber={pendingEmployee?.number ?? ''}
        company={selectedCompany}
      />
    </div>
  );
}

// Sub-components
interface AdminPanelProps {
  employees: EmployeesData;
  setEmployees: (data: EmployeesData | ((d: EmployeesData) => EmployeesData)) => void;
  consumptions: ConsumptionsData;
  setConsumptions: (data: ConsumptionsData | ((d: ConsumptionsData) => ConsumptionsData)) => void;
  selectedCompany: Company;
}

const AdminPanel: FC<AdminPanelProps> = ({ employees, setEmployees, consumptions, setConsumptions, selectedCompany }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState<DateRange | undefined>();
  const [reportCompany, setReportCompany] = useState<Company>('Inditex');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        const header = lines.shift()?.split(',').map(h => h.trim().toLowerCase()) || [];
        
        const requiredHeaders = ['employee_number', 'name', 'company', 'active'];
        if (!requiredHeaders.every(h => header.includes(h))) {
          throw new Error(`Encabezado de CSV inválido. Debe incluir: ${requiredHeaders.join(', ')}`);
        }
        
        const newEmployees = lines.map(line => {
          const values = line.split(',');
          const employeeObj: Partial<Employee> = {};
          header.forEach((h, i) => {
            (employeeObj as any)[h] = values[i];
          });
          employeeObj.active = String(employeeObj.active).toLowerCase() === 'true';
          return employeeObj as Employee;
        }).filter(e => e.company === selectedCompany);

        let addedCount = 0;
        let updatedCount = 0;

        setEmployees(prev => {
          const companyEmployees = [...prev[selectedCompany!]];
          newEmployees.forEach(newEmp => {
            const index = companyEmployees.findIndex(e => e.employee_number === newEmp.employee_number);
            if (index > -1) {
              companyEmployees[index] = { ...companyEmployees[index], ...newEmp };
              updatedCount++;
            } else {
              companyEmployees.push(newEmp);
              addedCount++;
            }
          });
          return { ...prev, [selectedCompany!]: companyEmployees };
        });

        toast({ title: 'Importación Exitosa', description: `${addedCount} empleados agregados, ${updatedCount} actualizados para ${selectedCompany}.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Falló la Importación', description: error.message });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };
  
  const handleExportEmployees = (company: Company) => {
    const companyEmployees = employees[company];
    const headers = ['employee_number', 'name', 'company', 'department', 'email', 'active'];
    const rows = [
      headers,
      ...companyEmployees.map(e => [e.employee_number, e.name, e.company, e.department || '', e.email || '', e.active])
    ];
    exportToCsv(`${company}_empleados_${new Date().toISOString().split('T')[0]}.csv`, rows);
  }

  const handleExportConsumptions = () => {
    if (!date?.from || !date?.to) {
        toast({variant: 'destructive', title: 'Por favor seleccione un rango de fechas.'});
        return;
    }
    const from = date.from.getTime();
    const to = date.to.getTime() + (24 * 60 * 60 * 1000 - 1); // include full end day

    const filteredConsumptions = consumptions[reportCompany].filter(c => {
        const c_time = new Date(c.timestamp).getTime();
        return c_time >= from && c_time <= to;
    });

    const headers = ['id', 'employee_number', 'name', 'company', 'timestamp', 'voided'];
    const rows = [
        headers,
        ...filteredConsumptions.map(c => [c.id, c.employee_number, c.name, c.company, c.timestamp, c.voided])
    ];

    const uniqueEmployees = new Set(filteredConsumptions.map(c => c.employee_number)).size;

    exportToCsv(`${reportCompany}_consumos_${format(date.from, "yyyy-MM-dd")}_a_${format(date.to, "yyyy-MM-dd")}.csv`, rows);
    toast({ title: 'Reporte Generado', description: `Total: ${filteredConsumptions.length} consumos de ${uniqueEmployees} empleados únicos.` });
  }

  const handleClearData = () => {
    setEmployees(INITIAL_EMPLOYEES);
    setConsumptions(INITIAL_CONSUMPTIONS);
    localStorage.removeItem('RGSTR_SEEDED');
    toast({ title: "Datos locales borrados." });
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Panel de Administración</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="employees">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="employees">Empleados</TabsTrigger>
            <TabsTrigger value="consumptions">Reportes</TabsTrigger>
            <TabsTrigger value="system">Sistema</TabsTrigger>
          </TabsList>
          <TabsContent value="employees" className="space-y-4 pt-4">
            <h3 className="font-semibold">Importar Empleados (CSV) para {selectedCompany}</h3>
            <Button variant="outline" className="w-full" onClick={() => { fileInputRef.current?.click();}}>
              <Upload className="mr-2 h-4 w-4" /> Importar para {selectedCompany}
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />

            <h3 className="font-semibold">Exportar Empleados de {selectedCompany}</h3>
            <Button variant="outline" className="w-full" onClick={() => handleExportEmployees(selectedCompany)}>
              <Download className="mr-2 h-4 w-4" /> Exportar para {selectedCompany}
            </Button>
             <h3 className="font-semibold">Añadir Rápido Empleado</h3>
              <QuickAddForm onAdd={(emp) => {
                setEmployees(prev => ({ ...prev, [emp.company]: [...prev[emp.company], emp] }));
                toast({ title: 'Empleado Añadido', description: `${emp.name} añadido a ${emp.company}.` });
              }} />
          </TabsContent>
          <TabsContent value="consumptions" className="space-y-4 pt-4">
            <h3 className="font-semibold">Exportar Consumos</h3>
            <div className="space-y-2">
              <label>Empresa</label>
              <Select value={reportCompany} onValueChange={(v) => setReportCompany(v as Company)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{COMPANIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
          <TabsContent value="system" className="space-y-4 pt-4">
             <h3 className="font-semibold text-destructive">Zona de Peligro</h3>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full"><Trash2 className="mr-2 h-4 w-4"/> Borrar Todos los Datos Locales</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>Esto eliminará todos los datos de empleados y consumos de tu navegador. Esta acción no se puede deshacer.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData}>Sí, borrar datos</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
    company: Company;
}

const QuickAddDialog: FC<QuickAddDialogProps> = ({ isOpen, setIsOpen, onActivate, employeeNumber, company }) => {
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
                        <Input value={company} readOnly disabled />
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

const QuickAddForm: FC<{ onAdd: (employee: Employee) => void }> = ({ onAdd }) => {
    const [open, setOpen] = useState(false);
    const [number, setNumber] = useState('');
    const [name, setName] = useState('');
    const [company, setCompany] = useState<Company>('Inditex');
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!number || !name) {
            toast({ variant: "destructive", title: "Error", description: "Se requiere número y nombre." });
            return;
        }
        onAdd({
            employee_number: number,
            name,
            company,
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
                        <Select value={company} onValueChange={v => setCompany(v as Company)}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>{COMPANIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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

    