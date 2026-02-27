
"use client";

import { useState, useEffect, useMemo, useRef, type ChangeEvent, type KeyboardEvent, type FC } from 'react';
import {
  AlertCircle,
  BarChart,
  CheckCircle,
  ChevronDown,
  Download,
  KeyRound,
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
  DollarSign,
  Save,
  Loader2,
  ChevronLeft
} from 'lucide-react';
import { format, subDays, startOfMonth, getDate, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DateRange } from 'react-day-picker';
import { useFirebase, useCollection, useDoc, useMemoFirebase, useUser, useAuth } from '@/firebase';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { signOut, type User } from 'firebase/auth';
import { formatInTimeZone, toDate, toZonedTime } from 'date-fns-tz';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';


import { type Company, type Employee, type Consumption, type UserProfile } from '@/lib/types';
import { cn, exportToCsv, getTodayInMexicoCity, formatTimestamp } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { AppShell, PageHeader } from '@/components/layout';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


export default function MainPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const auth = useAuth();
  const timeZone = 'America/Mexico_City';
  
  const userProfileRef = useMemoFirebase(() => 
    firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [confirmationData, setConfirmationData] = useState<Consumption | null>(null);
  const [isConfirmationOpen, setConfirmationOpen] = useState(false);
  const [paymentDue, setPaymentDue] = useState<{employee: Employee, amount: number} | null>(null);

  const allCompaniesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null,
  [firestore]);
  const { data: allCompanies, isLoading: companiesLoading } = useCollection<Company>(allCompaniesQuery);

  const companyDocRef = useMemoFirebase(() => 
    firestore && selectedCompanyId ? doc(firestore, `companies/${selectedCompanyId}`) : null
  , [firestore, selectedCompanyId]);
  const { data: company } = useDoc<Company>(companyDocRef);

  const employeesQuery = useMemoFirebase(() =>
    firestore && selectedCompanyId ? query(collection(firestore, `companies/${selectedCompanyId}/employees`)) : null
  , [firestore, selectedCompanyId]);
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const startOfCurrentMonth = useMemo(() => {
      const nowInMexicoCity = toZonedTime(new Date(), timeZone);
      return startOfMonth(nowInMexicoCity);
  }, [timeZone]);

  const todaysConsumptionsQuery = useMemoFirebase(() => {
      if (!firestore || !selectedCompanyId) return null;
      const todayMexico = getTodayInMexicoCity();
      const startOfDay = new Date(todayMexico + 'T00:00:00');
      const endOfDay = new Date(todayMexico + 'T23:59:59');

      return query(
          collection(firestore, `companies/${selectedCompanyId}/consumptions`), 
          where('timestamp', '>=', startOfDay.toISOString()),
          where('timestamp', '<=', endOfDay.toISOString())
      );
  }, [firestore, selectedCompanyId]);
  const { data: todaysConsumptions } = useCollection<Consumption>(todaysConsumptionsQuery);

  const recentConsumptionsQuery = useMemoFirebase(() => {
      if (!firestore || !selectedCompanyId) return null;
      return query(
          collection(firestore, `companies/${selectedCompanyId}/consumptions`),
          orderBy('timestamp', 'desc'),
          limit(10)
      )
  }, [firestore, selectedCompanyId]);
  const { data: recentConsumptions } = useCollection<Consumption>(recentConsumptionsQuery);

  const monthlyConsumptionsQuery = useMemoFirebase(() =>
      firestore && selectedCompanyId ? query(
          collection(firestore, `companies/${selectedCompanyId}/consumptions`),
          where('timestamp', '>=', startOfCurrentMonth.toISOString()),
          orderBy('timestamp', 'desc')
      ) : null
  , [firestore, selectedCompanyId, startOfCurrentMonth]);
  const { data: monthlyConsumptions } = useCollection<Consumption>(monthlyConsumptionsQuery);

  const [employeeNumber, setEmployeeNumber] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const [isQuickAddOpen, setQuickAddOpen] = useState(false);
  const [pendingEmployee, setPendingEmployee] = useState<{ number: string; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    if (!selectedCompanyId && allCompanies && allCompanies.length > 0) {
        const storedCompanyId = localStorage.getItem('selectedCompanyId');
        if (storedCompanyId && allCompanies.some(c => c.id === storedCompanyId)) {
            setSelectedCompanyId(storedCompanyId);
        } else {
            setSelectedCompanyId(allCompanies[0].id);
        }
    }
  }, [allCompanies, selectedCompanyId]);
  
  useEffect(() => {
    if (selectedCompanyId) {
        localStorage.setItem('selectedCompanyId', selectedCompanyId);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) {
      inputRef.current?.focus();
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const resetInputAndFeedback = () => {
    setEmployeeNumber('');
    setNameSearch('');
    inputRef.current?.focus();
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      setIsProcessing(false);
    }, 4000);
  };

  const proceedWithConsumption = (employee: Employee) => {
    if (!firestore || !selectedCompanyId || isProcessing) return;
    
    // This check is re-asserted here to prevent double submissions
    if (isProcessing) return;
    setIsProcessing(true);

    const newConsumptionData: Omit<Consumption, 'id'> = {
      employeeId: employee.id!,
      employeeNumber: employee.employeeNumber,
      name: employee.name,
      companyId: selectedCompanyId,
      timestamp: new Date().toISOString(),
      voided: false,
      status: 'completed', // Default status for non-kiosk consumptions
    };
    
    const newConsumption: Consumption = {
        ...newConsumptionData,
        id: `temp-${Date.now()}`
    }

    const consumptionsCollection = collection(firestore, `companies/${selectedCompanyId}/consumptions`);
    addDocumentNonBlocking(consumptionsCollection, newConsumptionData);
    
    setConfirmationData(newConsumption);
    setConfirmationOpen(true);
    
    resetInputAndFeedback();
  }

  const registerConsumption = (employee: Employee) => {
    if (isProcessing) return;
    setIsProcessing(true);

    if (!employee.active) {
        setFeedback({ type: 'error', message: `Empleado Inactivo: ${employee.name} (#${employee.employeeNumber})` });
        resetInputAndFeedback();
        return;
    }

    const today = getTodayInMexicoCity();
    const hasEatenToday = todaysConsumptions?.some(c => 
        c.employeeId === employee.id &&
        formatInTimeZone(new Date(c.timestamp), 'America/Mexico_City', 'yyyy-MM-dd') === today &&
        !c.voided
    );

    if (hasEatenToday) {
        setFeedback({ type: 'error', message: `Duplicado: ${employee.name} ya ha comido hoy.` });
        resetInputAndFeedback();
        return;
    }

    if (employee.paymentAmount && employee.paymentAmount > 0) {
        setPaymentDue({employee, amount: employee.paymentAmount});
    } else {
        proceedWithConsumption(employee);
    }
  }

  const handlePaymentCollected = () => {
    if (paymentDue) {
        proceedWithConsumption(paymentDue.employee);
        setPaymentDue(null);
    }
  };
  
  const handlePaymentCancelled = () => {
      setPaymentDue(null);
      resetInputAndFeedback();
  }


  const handleRegistrationByNumber = () => {
    if (!employeeNumber.trim() || !firestore || !selectedCompanyId || isProcessing) return;
    setIsProcessing(true);
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
      // Don't set isProcessing to false here, wait for dialog outcome
    }
  };

  const handleQuickActivate = (name: string) => {
    if (!pendingEmployee || !name.trim() || !firestore || !selectedCompanyId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Se requiere un nombre para la activación.' });
      return;
    }

    // isProcessing should already be true, but we ensure it here
    setIsProcessing(true);

    const newEmployeeData: Omit<Employee, 'id'> = {
      employeeNumber: pendingEmployee.number,
      name,
      companyId: selectedCompanyId,
      active: true,
      paymentAmount: 0,
      voided: false,
    };

    const employeesCollection = collection(firestore, `companies/${selectedCompanyId}/employees`);
    addDocumentNonBlocking(employeesCollection, newEmployeeData).then(docRef => {
        if (!docRef?.id) {
          toast({ variant: "destructive", title: "Error de Permisos", description: "No se pudo crear el nuevo empleado. Verifique sus permisos de administrador." });
          resetInputAndFeedback();
          return;
        };
        const newEmployee: Employee = { ...newEmployeeData, id: docRef.id };
        proceedWithConsumption(newEmployee); 
    }).catch(error => {
        toast({ variant: "destructive", title: "Error de Creación", description: error.message || "No se pudo crear el nuevo empleado." });
        resetInputAndFeedback();
    });

    setQuickAddOpen(false);
    setPendingEmployee(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRegistrationByNumber();
    }
  };
  
  const handleSignOut = async () => {
    if (auth) {
        await signOut(auth);
        if (typeof window !== 'undefined') {
            document.cookie = 'vidana_session=; path=/; max-age=0; SameSite=Strict';
        }
        localStorage.removeItem('selectedCompanyId');
        router.push('/login');
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!nameSearch) return [];
    return (employees || []).filter(
      (employee) =>
        employee.name.toLowerCase().includes(nameSearch.toLowerCase()) ||
        employee.employeeNumber.includes(nameSearch)
    );
  }, [nameSearch, employees]);

  if (userLoading || !user || companiesLoading || profileLoading || !selectedCompanyId || !company || !allCompanies) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
         <p className="ml-3 text-lg">Cargando datos de la empresa...</p>
      </div>
    );
  }

  const companySelector = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-44 justify-start h-8 text-sm border-border/60">
          <Building className="mr-2 h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{company?.name}</span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44">
        {allCompanies.map(c => (
          <DropdownMenuItem key={c.id} onSelect={() => setSelectedCompanyId(c.id)}>
            {c.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AppShell>
      <main className="container mx-auto p-4 sm:p-6 md:p-8">
        <PageHeader title="Registros" subtitle={company?.name ?? ''} action={companySelector} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-card border-gray-200/80 dark:border-gray-800/80">
            <CardHeader>
              <CardTitle className="text-2xl font-bold tracking-tight">Registrar Acceso a Comida</CardTitle>
              <CardDescription>Usa las pestañas para registrar por número de empleado o buscar por nombre.</CardDescription>
            </CardHeader>
            <CardContent>
               <Tabs defaultValue="number">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="number">Por Número</TabsTrigger>
                  <TabsTrigger value="name">Por Nombre</TabsTrigger>
                </TabsList>
                <TabsContent value="number" className="pt-6">
                  <div className="flex gap-4">
                    <Input
                      ref={inputRef}
                      autoFocus
                      value={employeeNumber}
                      onChange={(e) => setEmployeeNumber(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Número de Empleado para ${company?.name}`}
                      className="text-xl h-14 font-mono text-center tracking-widest flex-grow rounded-lg"
                      disabled={isProcessing}
                    />
                    <Button onClick={handleRegistrationByNumber} className="h-14 text-lg rounded-lg" disabled={isProcessing}>
                       {isProcessing ? <><Loader2 className="h-6 w-6 mr-2 animate-spin" /> Procesando...</> : <>Registrar</>}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="name" className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                        placeholder="Buscar por nombre o número de empleado..."
                        value={nameSearch}
                        onChange={(e) => setNameSearch(e.target.value)}
                        className="text-lg h-14 pl-10 rounded-lg"
                        disabled={isProcessing}
                        />
                    </div>
                    {nameSearch && (
                        <ScrollArea className="mt-4 h-[22rem] w-full rounded-md border">
                            <div className="p-2">
                                {filteredEmployees.length > 0 ? (
                                    filteredEmployees.map((employee) => (
                                    <div key={employee.id} onClick={() => !isProcessing && registerConsumption(employee)} className={cn("flex justify-between items-center p-3 rounded-md", isProcessing ? 'cursor-not-allowed text-muted-foreground' : 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer')}>
                                        <div>
                                            <p className="font-medium">{employee.name}</p>
                                            <p className="text-sm text-gray-500">#{employee.employeeNumber}</p>
                                        </div>
                                        {employee.paymentAmount && employee.paymentAmount > 0 && (
                                            <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                                                <DollarSign className="h-4 w-4 mr-1" />
                                                {employee.paymentAmount.toFixed(2)}
                                            </div>
                                        )}
                                        <Button size="sm" variant="outline" disabled={isProcessing}>Registrar</Button>
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
                <div className={cn("mt-6 p-4 rounded-lg flex items-center gap-3 text-base font-medium", {
                  'bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200': feedback.type === 'success',
                  'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300': feedback.type === 'warning',
                  'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300': feedback.type === 'error',
                })}>
                  {feedback.type === 'success' && <CheckCircle className="h-6 w-6" />}
                  {feedback.type === 'warning' && <AlertCircle className="h-6 w-6" />}
                  {feedback.type === 'error' && <XCircle className="h-6 w-6" />}
                  <span>{feedback.message}</span>
                </div>
              )}
            </CardContent>
          </Card>
          
          <RecentConsumptionsCard recentConsumptions={recentConsumptions} company={company} />

        </div>

        <div className="lg:col-span-1 space-y-8">
          <AdminPanel 
            employees={employees || []}
            todaysConsumptions={todaysConsumptions || []}
            monthlyConsumptions={monthlyConsumptions || []}
            selectedCompanyId={selectedCompanyId} 
            company={company}
            allCompanies={allCompanies || []}
          />
        </div>
        </div>
      </main>

      <QuickAddDialog
        isOpen={isQuickAddOpen}
        setIsOpen={(open) => {
            setQuickAddOpen(open);
            // If closing the dialog, reset the processing state
            if (!open) {
                resetInputAndFeedback();
            }
        }}
        onActivate={handleQuickActivate}
        employeeNumber={pendingEmployee?.number ?? ''}
        company={company}
        isProcessing={isProcessing}
      />
      <ConfirmationDialog
        isOpen={isConfirmationOpen}
        setIsOpen={setConfirmationOpen}
        consumption={confirmationData}
        company={company}
      />
       <PaymentDialog
        isOpen={!!paymentDue}
        onClose={handlePaymentCancelled}
        onConfirm={handlePaymentCollected}
        amount={paymentDue?.amount ?? 0}
        employeeName={paymentDue?.employee.name ?? ''}
      />
    </AppShell>
  );
}

// Sub-components

const RecentConsumptionsCard: FC<{recentConsumptions: Consumption[] | null, company: Company | null}> = ({ recentConsumptions, company }) => {
    const [highlighted, setHighlighted] = useState<string[]>([]);
    const prevConsumptionsRef = useRef<Consumption[]>();

    useEffect(() => {
        if (recentConsumptions && prevConsumptionsRef.current) {
            const newItems = recentConsumptions.filter(
                (newItem) => !prevConsumptionsRef.current!.some((oldItem) => oldItem.id === newItem.id)
            );
            if (newItems.length > 0) {
                setHighlighted(newItems.map(item => item.id!));
                const timer = setTimeout(() => {
                    setHighlighted([]);
                }, 1500);
                return () => clearTimeout(timer);
            }
        }
        prevConsumptionsRef.current = recentConsumptions || [];
    }, [recentConsumptions]);


    return (
        <Card className="shadow-card border-gray-200/80 dark:border-gray-800/80">
            <CardHeader>
                <CardTitle>Últimos 10 Consumos</CardTitle>
            </CardHeader>
            <CardContent>
                {!recentConsumptions ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="ml-3 text-muted-foreground">Cargando...</p>
                    </div>
                ) : recentConsumptions.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <Users className="h-8 w-8" />
                        <p className="mt-2">No hay consumos recientes.</p>
                    </div>
                ) : (
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
                                <TableRow
                                    key={c.id}
                                    className={cn(
                                        "transition-colors duration-1000 hover:bg-muted/30",
                                        c.id && highlighted.includes(c.id) ? 'bg-teal-50 dark:bg-teal-900/30' : ''
                                    )}
                                >
                                    <TableCell>{c.name}</TableCell>
                                    <TableCell className="font-mono text-muted-foreground">{c.employeeNumber}</TableCell>
                                    <TableCell>{company?.name}</TableCell>
                                    <TableCell className="font-mono text-xs">{formatTimestamp(c.timestamp)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}

interface AdminPanelProps {
  employees: Employee[];
  todaysConsumptions: Consumption[];
  monthlyConsumptions: Consumption[];
  selectedCompanyId: string;
  company: Company | null;
  allCompanies: Company[];
}

const AdminPanel: FC<AdminPanelProps> = ({ employees, todaysConsumptions, monthlyConsumptions, selectedCompanyId, company, allCompanies }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { firestore } = useFirebase();
  const [isLoading, setIsLoading] = useState(false);

  const [date, setDate] = useState<DateRange | undefined>();
  
  const dailyConsumptionCount = useMemo(() => {
    return todaysConsumptions.filter(c => !c.voided).length;
  }, [todaysConsumptions]);

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
        const paymentAmountIndex = header.indexOf('paymentamount');
  
        const newEmployees = lines.map(line => {
          const values = line.split(',');
          return {
            employeeNumber: values[employeeNumberIndex]?.trim(),
            name: values[nameIndex]?.trim(),
            active: String(values[activeIndex]).toLowerCase() === 'true',
            companyId: selectedCompanyId,
            paymentAmount: paymentAmountIndex > -1 ? parseFloat(values[paymentAmountIndex]?.trim()) || 0 : 0,
            voided: false,
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
                updateDocumentNonBlocking(docToUpdate.ref, { ...newEmp }).catch((e) => console.error("Error updating doc:", e));
                updatedCount++;
            } else {
                addDocumentNonBlocking(employeesCollection, newEmp).catch((e) => console.error("Error adding doc:", e));
                addedCount++;
            }
        }
  
        toast({ title: 'Importación Exitosa', description: `${addedCount} empleados agregados, ${updatedCount} actualizados para ${company?.name}.` });
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
    const headers = ['employeeNumber', 'name', 'companyId', 'department', 'email', 'active', 'paymentAmount'];
    const rows = [
      headers,
      ...employees.map(e => [e.employeeNumber, e.name, e.companyId, e.department || '', e.email || '', e.active, e.paymentAmount || 0])
    ];
    exportToCsv(`${selectedCompanyId}_empleados_${new Date().toISOString().split('T')[0]}.csv`, rows);
  }

  const handleExportConsumptions = async () => {
    if (!date?.from || !date?.to || !firestore) {
        toast({variant: 'destructive', title: 'Por favor seleccione un rango de fechas.'});
        return;
    }
    const from = date.from;
    const to = date.to;
    to.setHours(23, 59, 59, 999);

    const consumptionsToExportQuery = query(
        collection(firestore, `companies/${selectedCompanyId}/consumptions`),
        where('timestamp', '>=', from.toISOString()),
        where('timestamp', '<=', to.toISOString())
    );
    const snapshot = await getDocs(consumptionsToExportQuery);
    const filteredConsumptions = snapshot.docs.map(d => d.data() as Consumption);


    if (filteredConsumptions.length === 0) {
        toast({variant: 'destructive', title: 'Sin datos', description: 'No se encontraron consumos en ese rango.'});
        return;
    }

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
    if(!firestore || !company) return;
    const employeesCollection = collection(firestore, `companies/${company.id}/employees`);
    addDocumentNonBlocking(employeesCollection, employee)
        .then(() => {
            toast({ title: 'Empleado Añadido', description: `${employee.name} añadido a ${company.name}.` });
        })
        .catch((error) => {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo añadir el empleado.' });
        });
  }
  
  const todayStr = format(new Date(), 'dd/MM/yyyy');

  return (
    <>
      <Card className="shadow-card border-gray-200/80 dark:border-gray-800/80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Consumos {todayStr}</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{dailyConsumptionCount}</div>
          <p className="text-xs text-muted-foreground">
            Total de registros para {company?.name} hoy.
          </p>
        </CardContent>
      </Card>
      <Card className="shadow-card border-gray-200/80 dark:border-gray-800/80">
        <CardHeader>
          <CardTitle>Panel de Administración</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="statistics">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="employees">Empleados</TabsTrigger>
              <TabsTrigger value="consumptions">Reportes</TabsTrigger>
              <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
            </TabsList>
            <TabsContent value="employees" className="space-y-4 pt-6">
              <h3 className="font-semibold">Importar Empleados (CSV)</h3>
              <Button variant="outline" className="w-full" onClick={() => { fileInputRef.current?.click();}} disabled={isLoading}>
                <Upload className="mr-2 h-4 w-4" /> {isLoading ? `Importando...` : `Importar para ${company?.name}`}
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />

              <h3 className="font-semibold">Exportar Empleados</h3>
              <Button variant="outline" className="w-full" onClick={handleExportEmployees}>
                <Download className="mr-2 h-4 w-4" /> Exportar para {company?.name}
              </Button>
              <h3 className="font-semibold">Añadir Rápido Empleado</h3>
              <QuickAddForm onAdd={handleAddEmployee} company={company} />
            </TabsContent>
            <TabsContent value="consumptions" className="space-y-4 pt-6">
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
            <TabsContent value="statistics" className="space-y-4 pt-6">
              <ConsumptionChart consumptions={monthlyConsumptions} />
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
    company: Company | null;
    isProcessing: boolean;
}

const QuickAddDialog: FC<QuickAddDialogProps> = ({ isOpen, setIsOpen, onActivate, employeeNumber, company, isProcessing }) => {
    const [name, setName] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName('');
        }
    }, [isOpen]);

    const handleActivateClick = () => {
        if (isProcessing) return;
        onActivate(name);
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Activación Rápida de Empleado</DialogTitle>
                    <DialogDescription>Este empleado no está en la base de datos. Por favor, proporcione un nombre para activar.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label>Empresa</label>
                        <Input value={company?.name} readOnly disabled />
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
                    <DialogClose asChild><Button variant="ghost" disabled={isProcessing}>Cancelar</Button></DialogClose>
                    <Button onClick={handleActivateClick} disabled={isProcessing || !name.trim()}>
                        {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Activando...</> : <><UserPlus className="mr-2 h-4 w-4"/> Activar y Registrar</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const QuickAddForm: FC<{ onAdd: (employee: Omit<Employee, 'id'>) => void, company: Company | null }> = ({ onAdd, company }) => {
    const [open, setOpen] = useState(false);
    const [number, setNumber] = useState('');
    const [name, setName] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('0');
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!number || !name || !company) {
            toast({ variant: "destructive", title: "Error", description: "Se requiere número, nombre y empresa." });
            return;
        }
        onAdd({
            employeeNumber: number,
            name,
            companyId: company.id,
            active: true,
            paymentAmount: parseFloat(paymentAmount) || 0,
            voided: false,
        });
        setNumber('');
        setName('');
        setPaymentAmount('0');
        setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full" disabled={!company}><PlusCircle className="mr-2 h-4 w-4"/> Añadir Manualmente</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Añadir Rápido Empleado a {company?.name}</DialogTitle></DialogHeader>
                 <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label>Empresa</label>
                        <Input value={company?.name} readOnly disabled/>
                    </div>
                    <div className="space-y-2">
                        <label>Número de Empleado</label>
                        <Input value={number} onChange={e => setNumber(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <label>Nombre Completo</label>
                        <Input value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                     <div className="space-y-2">
                        <label>Monto de Pago (si aplica)</label>
                        <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" />
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
  company: Company | null;
}

const ConfirmationDialog: FC<ConfirmationDialogProps> = ({ isOpen, setIsOpen, consumption, company }) => {
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

    const companyName = company?.name || consumption.companyId;

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

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
  employeeName: string;
}

const PaymentDialog: FC<PaymentDialogProps> = ({ isOpen, onClose, onConfirm, amount, employeeName }) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-yellow-500" />
            Cobro Requerido
          </AlertDialogTitle>
          <AlertDialogDescription className="text-lg pt-4">
            Por favor, cobre la cantidad de <span className="font-bold">${amount.toFixed(2)}</span> a <span className="font-bold">{employeeName}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <AlertDialogAction onClick={onConfirm} className="bg-yellow-500 hover:bg-yellow-600">
            Cobrado y Continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};


const ConsumptionChart: FC<{ consumptions: Consumption[] | null }> = ({ consumptions }) => {
    const timeZone = 'America/Mexico_City';
    
    const chartData = useMemo(() => {
        if (!consumptions) return [];
        const dailyConsumptions: { [key: string]: number } = {};
        
        const lastActiveDays = [...new Set(consumptions.map(c => formatInTimeZone(new Date(c.timestamp), timeZone, 'yyyy-MM-dd')))]
            .sort((a,b) => new Date(b).getTime() - new Date(a).getTime())
            .slice(0, 10);

        consumptions.forEach(c => {
            if (!c.voided) {
                const day = formatInTimeZone(new Date(c.timestamp), timeZone, 'yyyy-MM-dd');
                if (lastActiveDays.includes(day)) {
                    dailyConsumptions[day] = (dailyConsumptions[day] || 0) + 1;
                }
            }
        });

        return Object.keys(dailyConsumptions)
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
            .map(day => ({
                name: format(toDate(day, { timeZone }), 'MMM dd', { locale: es }),
                total: dailyConsumptions[day],
            }));
    }, [consumptions, timeZone]);

    const stats = useMemo(() => {
        if (!consumptions || !chartData) return { total: 0, avg: 0, peakDay: 'N/A', peakTotal: 0 };
        
        const monthlyTotal = consumptions.filter(c => !c.voided).length;
        const nowInMexicoCity = toZonedTime(new Date(), timeZone);
        const dayOfMonth = getDate(nowInMexicoCity);

        const dailyAvg = dayOfMonth > 0 ? monthlyTotal / dayOfMonth : 0;
        
        const peak = chartData.reduce((max, item) => (item.total > max.total ? item : max), {name: 'N/A', total: 0});

        return {
            total: monthlyTotal,
            avg: Math.round(dailyAvg),
            peakDay: peak.name,
            peakTotal: peak.total,
        };
    }, [consumptions, chartData, timeZone]);

    if (!consumptions) {
        return (
            <div className="flex flex-col items-center justify-center h-80 border rounded-md bg-gray-50 dark:bg-gray-800/50">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (consumptions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-80 border rounded-md bg-gray-50 dark:bg-gray-800/50">
                <BarChart className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground mt-4">No hay datos de consumo para mostrar el gráfico.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-sm">Tendencia de Consumo (Mes Actual)</h3>
            <div className="grid gap-4 grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Consumos del Periodo</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Promedio Diario</CardTitle>
                        <BarChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.avg}</div>
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Día Pico ({stats.peakDay})</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.peakTotal}</div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <ResponsiveContainer width="100%" height={250}>
                        <RechartsBarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false}/>
                            <Tooltip 
                                cursor={{fill: 'hsl(var(--muted))'}}
                                contentStyle={{ 
                                    backgroundColor: 'hsl(var(--background))',
                                    borderColor: 'hsl(var(--border))',
                                    fontSize: '12px',
                                    borderRadius: '0.5rem',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                                }} 
                            />
                            <Bar dataKey="total" fill="hsl(var(--primary))" name="Consumos" radius={[4, 4, 0, 0]} />
                        </RechartsBarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
};

