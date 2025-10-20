
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
  LogOut,
  Building,
  Search,
  Printer,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { DateRange } from 'react-day-picker';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { formatInTimeZone } from 'date-fns-tz';

import { type Company, type Employee, type Consumption, COMPANIES } from '@/lib/types';
import { cn, exportToCsv, getTodayInMexicoCity, formatTimestamp } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/logo';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function HomePage() {
  const { app, firestore } = useFirebase();
  const router = useRouter();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [confirmationData, setConfirmationData] = useState<Consumption | null>(null);
  const [isConfirmationOpen, setConfirmationOpen] = useState(false);


  useEffect(() => {
    const companyId = localStorage.getItem('companyId');
    if (companyId) {
      setSelectedCompanyId(companyId);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (app) {
      const auth = getAuth(app);
      signInAnonymously(auth)
        .then(() => {
          setIsAuthenticated(true);
        })
        .catch((error) => {
          console.error("Anonymous auth failed:", error);
        });
    }
  }, [app]);

  const employeesQuery = useMemoFirebase(() =>
    firestore && selectedCompanyId ? query(collection(firestore, `companies/${selectedCompanyId}/employees`)) : null
  , [firestore, selectedCompanyId]);
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const consumptionsQuery = useMemoFirebase(() =>
    firestore && selectedCompanyId ? query(collection(firestore, `companies/${selectedCompanyId}/consumptions`), orderBy('timestamp', 'desc')) : null
  , [firestore, selectedCompanyId]);
  const { data: consumptions } = useCollection<Consumption>(consumptionsQuery);

  const recentConsumptionsQuery = useMemoFirebase(() =>
    firestore && selectedCompanyId ? query(collection(firestore, `companies/${selectedCompanyId}/consumptions`), orderBy('timestamp', 'desc'), limit(10)) : null
  , [firestore, selectedCompanyId]);
  const { data: recentConsumptions } = useCollection<Consumption>(recentConsumptionsQuery);

  const [employeeNumber, setEmployeeNumber] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const [isQuickAddOpen, setQuickAddOpen] = useState(false);
  const [pendingEmployee, setPendingEmployee] = useState<{ number: string; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedCompanyId) {
      inputRef.current?.focus();
    }
  }, [selectedCompanyId]);

  const resetInputAndFeedback = () => {
    setEmployeeNumber('');
    setNameSearch('');
    inputRef.current?.focus();
    setTimeout(() => setFeedback(null), 4000);
  };

  const registerConsumption = (employee: Employee) => {
    if (!firestore || !selectedCompanyId) return;

    if (!employee.active) {
        setFeedback({ type: 'error', message: `Empleado Inactivo: ${employee.name} (#${employee.employeeNumber})` });
        resetInputAndFeedback();
        return;
    }

    const newConsumptionData: Omit<Consumption, 'id'> = {
      employeeId: employee.id!,
      employeeNumber: employee.employeeNumber,
      name: employee.name,
      companyId: selectedCompanyId,
      timestamp: new Date().toISOString(),
      voided: false,
    };
    
    const newConsumption: Consumption = {
        ...newConsumptionData,
        id: `temp-${Date.now()}` // temporary id
    }

    const consumptionsCollection = collection(firestore, `companies/${selectedCompanyId}/consumptions`);
    addDocumentNonBlocking(consumptionsCollection, newConsumptionData);
    
    setConfirmationData(newConsumption);
    setConfirmationOpen(true);
    
    resetInputAndFeedback();
  }

  const handleRegistrationByNumber = () => {
    if (!employeeNumber.trim() || !firestore || !selectedCompanyId) return;

    const employee = employees?.find(e => e.employeeNumber === employeeNumber.trim());

    if (employee) {
      registerConsumption(employee);
    } else {
      setFeedback({
        type: 'warning',
        message: `Empleado desconocido #${employeeNumber}. ¿Activar rápidamente?`,
      });
      setPendingEmployee({ number: employeeNumber, name: '' });
      setQuickAddOpen(true);
    }
  };

  const handleQuickActivate = (name: string) => {
    if (!pendingEmployee || !name.trim() || !firestore || !selectedCompanyId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Se requiere un nombre para la activación.' });
      return;
    }

    const newEmployeeData: Omit<Employee, 'id'> = {
      employeeNumber: pendingEmployee.number,
      name,
      companyId: selectedCompanyId,
      active: true,
    };

    const employeesCollection = collection(firestore, `companies/${selectedCompanyId}/employees`);
    addDocumentNonBlocking(employeesCollection, newEmployeeData).then(docRef => {
        if (!docRef) return;
        const newEmployee = { ...newEmployeeData, id: docRef.id };
        registerConsumption(newEmployee);
    });

    setQuickAddOpen(false);
    setPendingEmployee(null);
    resetInputAndFeedback();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRegistrationByNumber();
    }
  };

  const handleCompanySelect = (companyId: string) => {
    localStorage.setItem('companyId', companyId);
    setSelectedCompanyId(companyId);
  };
  
  const handleSignOut = () => {
    localStorage.removeItem('companyId');
    setSelectedCompanyId(null);
  };

  const filteredEmployees = useMemo(() => {
    if (!nameSearch) return [];
    return (employees || []).filter(
      (employee) =>
        employee.name.toLowerCase().includes(nameSearch.toLowerCase()) ||
        employee.employeeNumber.includes(nameSearch)
    );
  }, [nameSearch, employees]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Cargando y autenticando...</p>
      </div>
    );
  }

  if (!selectedCompanyId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md mx-4 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Logo />
            </div>
            <CardTitle className="text-2xl">Seleccionar Empresa</CardTitle>
            <CardDescription>Elija la empresa para la que desea registrar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {COMPANIES.map(company => (
              <Button 
                key={company.id} 
                onClick={() => handleCompanySelect(company.id)}
                className="w-full h-12 text-lg"
              >
                {company.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <header className="flex justify-between items-center mb-8">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 h-12 px-4 border rounded-md bg-gray-100 dark:bg-gray-800">
            <Building className="h-5 w-5 text-gray-500" />
            <span className="text-lg font-medium">{COMPANIES.find(c => c.id === selectedCompanyId)?.name}</span>
          </div>
           <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Cambiar Empresa
          </Button>
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Registrar Acceso a Comida</CardTitle>
              <CardDescription>Usa las pestañas para registrar por número de empleado o buscar por nombre.</CardDescription>
            </CardHeader>
            <CardContent>
               <Tabs defaultValue="number">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="number">Por Número (Escaner)</TabsTrigger>
                  <TabsTrigger value="name">Por Nombre</TabsTrigger>
                </TabsList>
                <TabsContent value="number" className="pt-4">
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
                    <Button onClick={handleRegistrationByNumber} className="h-16 text-lg">
                      <ChevronDown className="h-6 w-6 mr-2 rotate-90" /> Enviar
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="name" className="pt-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                        placeholder="Buscar por nombre o número de empleado..."
                        value={nameSearch}
                        onChange={(e) => setNameSearch(e.target.value)}
                        className="text-lg h-16 pl-10"
                        />
                    </div>
                    {nameSearch && (
                        <ScrollArea className="mt-4 h-72 w-full rounded-md border">
                            <div className="p-4">
                                {filteredEmployees.length > 0 ? (
                                    filteredEmployees.map((employee) => (
                                    <div key={employee.id} onClick={() => registerConsumption(employee)} className="flex justify-between items-center p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                                        <div>
                                            <p className="font-medium">{employee.name}</p>
                                            <p className="text-sm text-gray-500">#{employee.employeeNumber}</p>
                                        </div>
                                        <Button size="sm" variant="outline">Registrar</Button>
                                    </div>
                                    ))
                                ) : (
                                    <p className="p-4 text-center text-gray-500">No se encontraron empleados.</p>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </TabsContent>
              </Tabs>

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

        <div className="md:col-span-1 space-y-8">
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
      <ConfirmationDialog
        isOpen={isConfirmationOpen}
        setIsOpen={setConfirmationOpen}
        consumption={confirmationData}
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
  const [isLoading, setIsLoading] = useState(false);

  const [date, setDate] = useState<DateRange | undefined>();
  
  const dailyConsumptionCount = useMemo(() => {
    const today = getTodayInMexicoCity();
    return consumptions.filter(c => {
      const consumptionDate = formatInTimeZone(new Date(c.timestamp), 'America/Mexico_City', 'yyyy-MM-dd');
      return consumptionDate === today && !c.voided;
    }).length;
  }, [consumptions]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore) return;
  
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        const header = lines.shift()?.split(',').map(h => h.trim().toLowerCase()) || [];
        
        const requiredHeaders = ['employeenumber', 'name', 'active'];
        if (!requiredHeaders.every(h => header.includes(h))) {
          throw new Error(`Encabezado de CSV inválido. Debe incluir: ${requiredHeaders.join(', ')}`);
        }
        
        const employeeNumberIndex = header.indexOf('employeenumber');
        const nameIndex = header.indexOf('name');
        const activeIndex = header.indexOf('active');
  
        const newEmployees = lines.map(line => {
          const values = line.split(',');
          return {
            employeeNumber: values[employeeNumberIndex]?.trim(),
            name: values[nameIndex]?.trim(),
            active: String(values[activeIndex]).toLowerCase() === 'true',
            companyId: selectedCompanyId,
          } as Omit<Employee, 'id'>;
        }).filter(emp => emp.employeeNumber && emp.name);
  
        let addedCount = 0;
        let updatedCount = 0;
  
        const employeesCollection = collection(firestore, `companies/${selectedCompanyId}/employees`);
        
        for (const newEmp of newEmployees) {
            const q = query(employeesCollection, where('employeeNumber', '==', newEmp.employeeNumber));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docToUpdate = querySnapshot.docs[0];
                updateDocumentNonBlocking(docToUpdate.ref, { ...newEmp });
                updatedCount++;
            } else {
                addDocumentNonBlocking(employeesCollection, newEmp);
                addedCount++;
            }
        }
  
        toast({ title: 'Importación Exitosa', description: `${addedCount} empleados agregados, ${updatedCount} actualizados para ${selectedCompanyId}.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Falló la Importación', description: error.message });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };
  
  const handleExportEmployees = () => {
    const headers = ['employeeNumber', 'name', 'companyId', 'department', 'email', 'active'];
    const rows = [
      headers,
      ...employees.map(e => [e.employeeNumber, e.name, e.companyId, e.department || '', e.email || '', e.active])
    ];
    exportToCsv(`${selectedCompanyId}_empleados_${new Date().toISOString().split('T')[0]}.csv`, rows);
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
        return c.companyId === selectedCompanyId && c_time >= from && c_time <= to;
    });

    const headers = ['Nombre', 'Numero de Empleado', 'Fecha', 'Hora'];
    const rows = [
        headers,
        ...filteredConsumptions.map(c => {
          const consumptionDate = new Date(c.timestamp);
          return [
            c.name, 
            c.employeeNumber, 
            format(consumptionDate, "yyyy-MM-dd"), 
            format(consumptionDate, "HH:mm:ss")
          ]
        })
    ];

    const uniqueEmployees = new Set(filteredConsumptions.map(c => c.employeeNumber)).size;

    exportToCsv(`${selectedCompanyId}_consumos_${format(date.from, "yyyy-MM-dd")}_a_${format(date.to, "yyyy-MM-dd")}.csv`, rows);
    toast({ title: 'Reporte Generado', description: `Total: ${filteredConsumptions.length} consumos de ${uniqueEmployees} empleados únicos.` });
  }

  const handleAddEmployee = (employee: Omit<Employee, 'id'>) => {
    if(!firestore) return;
    const employeesCollection = collection(firestore, `companies/${employee.companyId}/employees`);
    addDocumentNonBlocking(employeesCollection, employee);
    toast({ title: 'Empleado Añadido', description: `${employee.name} añadido a ${employee.companyId}.` });
  }
  
  const todayStr = format(new Date(), 'dd/MM/yyyy');

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Consumos {todayStr}</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{dailyConsumptionCount}</div>
          <p className="text-xs text-muted-foreground">
            Total de registros para {COMPANIES.find(c => c.id === selectedCompanyId)?.name} hoy.
          </p>
        </CardContent>
      </Card>
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
              <h3 className="font-semibold">Importar Empleados (CSV)</h3>
              <Button variant="outline" className="w-full" onClick={() => { fileInputRef.current?.click();}} disabled={isLoading}>
                <Upload className="mr-2 h-4 w-4" /> {isLoading ? `Importando...` : `Importar para ${selectedCompanyId}`}
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />

              <h3 className="font-semibold">Exportar Empleados</h3>
              <Button variant="outline" className="w-full" onClick={handleExportEmployees}>
                <Download className="mr-2 h-4 w-4" /> Exportar para {selectedCompanyId}
              </Button>
              <h3 className="font-semibold">Añadir Rápido Empleado</h3>
              <QuickAddForm onAdd={handleAddEmployee} defaultCompanyId={selectedCompanyId} />
            </TabsContent>
            <TabsContent value="consumptions" className="space-y-4 pt-4">
              <h3 className="font-semibold">Exportar Consumos</h3>
              
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
    </>
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
                        <Input value={COMPANIES.find(c => c.id === companyId)?.name} readOnly disabled />
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

const QuickAddForm: FC<{ onAdd: (employee: Omit<Employee, 'id'>) => void, defaultCompanyId: string }> = ({ onAdd, defaultCompanyId }) => {
    const [open, setOpen] = useState(false);
    const [number, setNumber] = useState('');
    const [name, setName] = useState('');
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
            companyId: defaultCompanyId,
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
                <DialogHeader><DialogTitle>Añadir Rápido Empleado a {COMPANIES.find(c => c.id === defaultCompanyId)?.name}</DialogTitle></DialogHeader>
                 <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label>Empresa</label>
                        <Input value={COMPANIES.find(c => c.id === defaultCompanyId)?.name} readOnly disabled/>
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

interface ConfirmationDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  consumption: Consumption | null;
}

const ConfirmationDialog: FC<ConfirmationDialogProps> = ({ isOpen, setIsOpen, consumption }) => {
    const receiptRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const printContent = receiptRef.current;
        if (printContent) {
            const receiptWindow = window.open('', '_blank', 'height=400,width=600');
            receiptWindow?.document.write('<html><head><title>Recibo de Comida</title>');
            receiptWindow?.document.write(`
                <style>
                    @media print {
                        body { 
                            font-family: monospace; 
                            padding: 20px; 
                            width: 300px;
                        }
                        .receipt-container { width: 100%; margin: 0 auto; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;}
                        .item span:first-child { font-weight: bold; }
                        .footer { text-align: center; margin-top: 20px; font-size: 12px; }
                        @page {
                           size: 80mm 100mm;
                           margin: 0;
                        }
                    }
                    body { font-family: monospace; }
                    .receipt-container { width: 300px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .item { display: flex; justify-content: space-between; margin-bottom: 8px; }
                    .item span:first-child { font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; }
                </style>
            `);
            receiptWindow?.document.write('</head><body>');
            receiptWindow?.document.write(printContent.innerHTML);
            receiptWindow?.document.write('</body></html>');
            receiptWindow?.document.close();
            receiptWindow?.focus();
            setTimeout(() => {
                receiptWindow?.print();
                receiptWindow?.close();
            }, 250);
        }
    };

    if (!consumption) return null;

    const companyName = COMPANIES.find(c => c.id === consumption.companyId)?.name || consumption.companyId;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle className="h-7 w-7 text-green-500" />
                        Registro Exitoso
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <div ref={receiptRef} className="receipt-container">
                        <div className="header">
                            <h3 className="text-xl font-bold">Recibo de Comida</h3>
                            <p className="text-sm">{companyName}</p>
                        </div>
                        <div className="space-y-3 text-lg item-list">
                            <div className="item">
                                <span className="font-semibold text-gray-500">Nombre:</span>
                                <span className="font-bold text-right">{consumption.name}</span>
                            </div>
                            <div className="item">
                                <span className="font-semibold text-gray-500"># Empleado:</span>
                                <span>{consumption.employeeNumber}</span>
                            </div>
                            <div className="item">
                                <span className="font-semibold text-gray-500">Fecha y Hora:</span>
                                <span className="text-right">{formatTimestamp(consumption.timestamp)}</span>
                            </div>
                        </div>
                        <div className="footer">
                            <p>¡Buen provecho!</p>
                        </div>
                    </div>
                </div>
                <DialogFooter className="sm:justify-between">
                    <Button onClick={handlePrint} variant="outline">
                        <Printer className="mr-2 h-4 w-4" /> Imprimir Recibo
                    </Button>
                    <DialogClose asChild>
                        <Button>Cerrar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
