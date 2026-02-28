'use client';

import { useState, useEffect, useMemo, useRef, type KeyboardEvent, type FC } from 'react';
import {
  AlertCircle,
  CheckCircle,
  DollarSign,
  Loader2,
  Search,
  UserPlus,
  Users,
  XCircle,
  Printer,
} from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { formatInTimeZone } from 'date-fns-tz';

import { type Company, type Employee, type Consumption } from '@/lib/types';
import { cn, getTodayInMexicoCity, formatTimestamp } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EmployeeSearchProps {
  companyId: string;
  company: Company;
}

export function EmployeeSearch({ companyId, company }: EmployeeSearchProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmationData, setConfirmationData] = useState<Consumption | null>(null);
  const [isConfirmationOpen, setConfirmationOpen] = useState(false);
  const [paymentDue, setPaymentDue] = useState<{ employee: Employee; amount: number } | null>(null);
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [isQuickAddOpen, setQuickAddOpen] = useState(false);
  const [pendingEmployee, setPendingEmployee] = useState<{ number: string; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const employeesQuery = useMemoFirebase(
    () =>
      firestore && companyId
        ? query(collection(firestore, `companies/${companyId}/employees`))
        : null,
    [firestore, companyId]
  );
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const todaysConsumptionsQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    const todayMexico = getTodayInMexicoCity();
    const startOfDay = new Date(todayMexico + 'T00:00:00');
    const endOfDay = new Date(todayMexico + 'T23:59:59');
    return query(
      collection(firestore, `companies/${companyId}/consumptions`),
      where('timestamp', '>=', startOfDay.toISOString()),
      where('timestamp', '<=', endOfDay.toISOString())
    );
  }, [firestore, companyId]);
  const { data: todaysConsumptions } = useCollection<Consumption>(todaysConsumptionsQuery);

  const recentConsumptionsQuery = useMemoFirebase(
    () =>
      firestore && companyId
        ? query(
            collection(firestore, `companies/${companyId}/consumptions`),
            orderBy('timestamp', 'desc'),
            limit(10)
          )
        : null,
    [firestore, companyId]
  );
  const { data: recentConsumptions } = useCollection<Consumption>(recentConsumptionsQuery);

  useEffect(() => {
    if (companyId) {
      inputRef.current?.focus();
    }
  }, [companyId]);

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
    if (!firestore || !companyId || isProcessing) return;
    if (isProcessing) return;
    setIsProcessing(true);

    const newConsumptionData: Omit<Consumption, 'id'> = {
      employeeId: employee.id!,
      employeeNumber: employee.employeeNumber,
      name: employee.name,
      companyId: companyId,
      timestamp: new Date().toISOString(),
      voided: false,
      status: 'completed',
    };

    const newConsumption: Consumption = {
      ...newConsumptionData,
      id: `temp-${Date.now()}`,
    };

    const consumptionsCollection = collection(firestore, `companies/${companyId}/consumptions`);
    addDocumentNonBlocking(consumptionsCollection, newConsumptionData);

    setConfirmationData(newConsumption);
    setConfirmationOpen(true);

    resetInputAndFeedback();
  };

  const registerConsumption = (employee: Employee) => {
    if (isProcessing) return;
    setIsProcessing(true);

    if (!employee.active) {
      setFeedback({ type: 'error', message: `Empleado Inactivo: ${employee.name} (#${employee.employeeNumber})` });
      resetInputAndFeedback();
      return;
    }

    const today = getTodayInMexicoCity();
    const hasEatenToday = todaysConsumptions?.some(
      (c) =>
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
      setPaymentDue({ employee, amount: employee.paymentAmount });
    } else {
      proceedWithConsumption(employee);
    }
  };

  const handlePaymentCollected = () => {
    if (paymentDue) {
      proceedWithConsumption(paymentDue.employee);
      setPaymentDue(null);
    }
  };

  const handlePaymentCancelled = () => {
    setPaymentDue(null);
    resetInputAndFeedback();
  };

  const handleRegistrationByNumber = () => {
    if (!employeeNumber.trim() || !firestore || !companyId || isProcessing) return;
    setIsProcessing(true);
    const employee = employees?.find((e) => e.employeeNumber === employeeNumber.trim());

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
    if (!pendingEmployee || !name.trim() || !firestore || !companyId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Se requiere un nombre para la activación.' });
      return;
    }

    setIsProcessing(true);

    const newEmployeeData: Omit<Employee, 'id'> = {
      employeeNumber: pendingEmployee.number,
      name,
      companyId: companyId,
      active: true,
      paymentAmount: 0,
      voided: false,
    };

    const employeesCollection = collection(firestore, `companies/${companyId}/employees`);
    addDocumentNonBlocking(employeesCollection, newEmployeeData)
      .then((docRef) => {
        if (!docRef?.id) {
          toast({
            variant: 'destructive',
            title: 'Error de Permisos',
            description: 'No se pudo crear el nuevo empleado. Verifique sus permisos de administrador.',
          });
          resetInputAndFeedback();
          return;
        }
        const newEmployee: Employee = { ...newEmployeeData, id: docRef.id };
        proceedWithConsumption(newEmployee);
      })
      .catch((error) => {
        toast({
          variant: 'destructive',
          title: 'Error de Creación',
          description: error.message || 'No se pudo crear el nuevo empleado.',
        });
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

  const filteredEmployees = useMemo(() => {
    if (!nameSearch) return [];
    return (employees || []).filter(
      (employee) =>
        employee.name.toLowerCase().includes(nameSearch.toLowerCase()) ||
        employee.employeeNumber.includes(nameSearch)
    );
  }, [nameSearch, employees]);

  return (
    <>
      <Card className="shadow-card border-gray-200/80 dark:border-gray-800/80">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">Registrar Acceso a Comida</CardTitle>
          <CardDescription>
            Usa las pestañas para registrar por número de empleado o buscar por nombre.
          </CardDescription>
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
                <Button
                  onClick={handleRegistrationByNumber}
                  className="h-14 text-lg rounded-lg"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Procesando...
                    </>
                  ) : (
                    <>Registrar</>
                  )}
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
                        <div
                          key={employee.id}
                          onClick={() => !isProcessing && registerConsumption(employee)}
                          className={cn(
                            'flex justify-between items-center p-3 rounded-md',
                            isProcessing
                              ? 'cursor-not-allowed text-muted-foreground'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                          )}
                        >
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
                          <Button size="sm" variant="outline" disabled={isProcessing}>
                            Registrar
                          </Button>
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
            <div
              className={cn('mt-6 p-4 rounded-lg flex items-center gap-3 text-base font-medium', {
                'bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200': feedback.type === 'success',
                'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300':
                  feedback.type === 'warning',
                'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300': feedback.type === 'error',
              })}
            >
              {feedback.type === 'success' && <CheckCircle className="h-6 w-6" />}
              {feedback.type === 'warning' && <AlertCircle className="h-6 w-6" />}
              {feedback.type === 'error' && <XCircle className="h-6 w-6" />}
              <span>{feedback.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <RecentConsumptionsCard recentConsumptions={recentConsumptions} company={company} />

      <QuickAddDialog
        isOpen={isQuickAddOpen}
        setIsOpen={(open) => {
          setQuickAddOpen(open);
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
    </>
  );
}

// ─── Sub-components (local, tightly coupled) ─────────────────────────────────

const RecentConsumptionsCard: FC<{ recentConsumptions: Consumption[] | null; company: Company | null }> = ({
  recentConsumptions,
  company,
}) => {
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const prevConsumptionsRef = useRef<Consumption[]>();

  useEffect(() => {
    if (recentConsumptions && prevConsumptionsRef.current) {
      const newItems = recentConsumptions.filter(
        (newItem) => !prevConsumptionsRef.current!.some((oldItem) => oldItem.id === newItem.id)
      );
      if (newItems.length > 0) {
        setHighlighted(newItems.map((item) => item.id!));
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
              {recentConsumptions.map((c) => (
                <TableRow
                  key={c.id}
                  className={cn(
                    'transition-colors duration-1000 hover:bg-muted/30',
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
  );
};

interface QuickAddDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onActivate: (name: string) => void;
  employeeNumber: string;
  company: Company | null;
  isProcessing: boolean;
}

const QuickAddDialog: FC<QuickAddDialogProps> = ({
  isOpen,
  setIsOpen,
  onActivate,
  employeeNumber,
  company,
  isProcessing,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
    }
  }, [isOpen]);

  const handleActivateClick = () => {
    if (isProcessing) return;
    onActivate(name);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activación Rápida de Empleado</DialogTitle>
          <DialogDescription>
            Este empleado no está en la base de datos. Por favor, proporcione un nombre para activar.
          </DialogDescription>
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
            <Input
              id="quick-add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej., Juan Pérez"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleActivateClick()}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isProcessing}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={handleActivateClick} disabled={isProcessing || !name.trim()}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Activando...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" /> Activar y Registrar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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
            body { font-family: monospace; padding: 20px; width: 300px; }
            .receipt-container { width: 100%; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;}
            .item span:first-child { font-weight: bold; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; }
            @page { size: 80mm 100mm; margin: 0; }
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
            Por favor, cobre la cantidad de <span className="font-bold">${amount.toFixed(2)}</span> a{' '}
            <span className="font-bold">{employeeName}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <AlertDialogAction onClick={onConfirm} className="bg-yellow-500 hover:bg-yellow-600">
            Cobrado y Continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
