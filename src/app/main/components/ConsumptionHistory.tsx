'use client';

import { useState, useMemo, useRef, type ChangeEvent, type FC } from 'react';
import {
  BarChart,
  CheckCircle,
  Download,
  Calendar as CalendarIcon,
  Loader2,
  PlusCircle,
  Upload,
  Users,
  DollarSign,
} from 'lucide-react';
import { format, getDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useFirebase } from '@/firebase';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatInTimeZone, toDate, toZonedTime } from 'date-fns-tz';
import {
  Bar,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

import { type Company, type Employee, type Consumption } from '@/lib/types';
import { cn, exportToCsv } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/ui/empty-state';
import { ClipboardList } from 'lucide-react';

interface ConsumptionHistoryProps {
  companyId: string;
  company: Company;
  employees: Employee[];
  todaysConsumptions: Consumption[];
  monthlyConsumptions: Consumption[];
}

export function ConsumptionHistory({
  companyId,
  company,
  employees,
  todaysConsumptions,
  monthlyConsumptions,
}: ConsumptionHistoryProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { firestore } = useFirebase();
  const [isLoading, setIsLoading] = useState(false);

  const [date, setDate] = useState<DateRange | undefined>();

  const dailyConsumptionCount = useMemo(() => {
    return todaysConsumptions.filter((c) => !c.voided).length;
  }, [todaysConsumptions]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
        const header = lines.shift()?.split(',').map((h) => h.trim().toLowerCase()) || [];

        const requiredHeaders = ['employeenumber', 'name', 'active'];
        if (!requiredHeaders.every((h) => header.includes(h))) {
          throw new Error(`Encabezado de CSV inválido. Debe incluir: ${requiredHeaders.join(', ')}`);
        }

        const employeeNumberIndex = header.indexOf('employeenumber');
        const nameIndex = header.indexOf('name');
        const activeIndex = header.indexOf('active');
        const paymentAmountIndex = header.indexOf('paymentamount');

        const newEmployees = lines
          .map((line) => {
            const values = line.split(',');
            return {
              employeeNumber: values[employeeNumberIndex]?.trim(),
              name: values[nameIndex]?.trim(),
              active: String(values[activeIndex]).toLowerCase() === 'true',
              companyId: companyId,
              paymentAmount:
                paymentAmountIndex > -1 ? parseFloat(values[paymentAmountIndex]?.trim()) || 0 : 0,
              voided: false,
            } as Omit<Employee, 'id'>;
          })
          .filter((emp) => emp.employeeNumber && emp.name);

        let addedCount = 0;
        let updatedCount = 0;

        const employeesCollection = collection(firestore, `companies/${companyId}/employees`);

        for (const newEmp of newEmployees) {
          const q = query(employeesCollection, where('employeeNumber', '==', newEmp.employeeNumber));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const docToUpdate = querySnapshot.docs[0];
            updateDocumentNonBlocking(docToUpdate.ref, { ...newEmp }).catch((e) =>
              console.error('Error updating doc:', e)
            );
            updatedCount++;
          } else {
            addDocumentNonBlocking(employeesCollection, newEmp).catch((e) =>
              console.error('Error adding doc:', e)
            );
            addedCount++;
          }
        }

        toast({
          title: 'Importación Exitosa',
          description: `${addedCount} empleados agregados, ${updatedCount} actualizados para ${company?.name}.`,
        });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Falló la Importación', description: error.message });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportEmployees = () => {
    const headers = ['employeeNumber', 'name', 'companyId', 'department', 'email', 'active', 'paymentAmount'];
    const rows = [
      headers,
      ...employees.map((e) => [
        e.employeeNumber,
        e.name,
        e.companyId,
        e.department || '',
        e.email || '',
        e.active,
        e.paymentAmount || 0,
      ]),
    ];
    exportToCsv(`${companyId}_empleados_${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  const handleExportConsumptions = async () => {
    if (!date?.from || !date?.to || !firestore) {
      toast({ variant: 'destructive', title: 'Por favor seleccione un rango de fechas.' });
      return;
    }
    const from = date.from;
    const to = date.to;
    to.setHours(23, 59, 59, 999);

    const consumptionsToExportQuery = query(
      collection(firestore, `companies/${companyId}/consumptions`),
      where('timestamp', '>=', from.toISOString()),
      where('timestamp', '<=', to.toISOString())
    );
    const snapshot = await getDocs(consumptionsToExportQuery);
    const filteredConsumptions = snapshot.docs.map((d) => d.data() as Consumption);

    if (filteredConsumptions.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Sin datos',
        description: 'No se encontraron consumos en ese rango.',
      });
      return;
    }

    const headers = ['Nombre', 'Numero de Empleado', 'Fecha', 'Hora'];
    const rows = [
      headers,
      ...filteredConsumptions.map((c) => {
        const consumptionDate = new Date(c.timestamp);
        return [
          c.name,
          c.employeeNumber,
          format(consumptionDate, 'yyyy-MM-dd'),
          format(consumptionDate, 'HH:mm:ss'),
        ];
      }),
    ];

    const uniqueEmployees = new Set(filteredConsumptions.map((c) => c.employeeNumber)).size;

    exportToCsv(
      `${companyId}_consumos_${format(date.from, 'yyyy-MM-dd')}_a_${format(date.to, 'yyyy-MM-dd')}.csv`,
      rows
    );
    toast({
      title: 'Reporte Generado',
      description: `Total: ${filteredConsumptions.length} consumos de ${uniqueEmployees} empleados únicos.`,
    });
  };

  const handleAddEmployee = (employee: Omit<Employee, 'id'>) => {
    if (!firestore || !company) return;
    const employeesCollection = collection(firestore, `companies/${company.id}/employees`);
    addDocumentNonBlocking(employeesCollection, employee)
      .then(() => {
        toast({ title: 'Empleado Añadido', description: `${employee.name} añadido a ${company.name}.` });
      })
      .catch((error) => {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'No se pudo añadir el empleado.',
        });
      });
  };

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
          <p className="text-xs text-muted-foreground">Total de registros para {company?.name} hoy.</p>
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
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                disabled={isLoading}
              >
                <Upload className="mr-2 h-4 w-4" />{' '}
                {isLoading ? `Importando...` : `Importar para ${company?.name}`}
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
                      variant={'outline'}
                      className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date?.from ? (
                        date.to ? (
                          <>
                            {format(date.from, 'LLL dd, y', { locale: es })} -{' '}
                            {format(date.to, 'LLL dd, y', { locale: es })}
                          </>
                        ) : (
                          format(date.from, 'LLL dd, y', { locale: es })
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
              <Button className="w-full" onClick={handleExportConsumptions}>
                <Download className="mr-2 h-4 w-4" /> Exportar Reporte
              </Button>
            </TabsContent>
            <TabsContent value="statistics" className="space-y-4 pt-6">
              <ConsumptionChart consumptions={monthlyConsumptions} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const QuickAddForm: FC<{ onAdd: (employee: Omit<Employee, 'id'>) => void; company: Company | null }> = ({
  onAdd,
  company,
}) => {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('0');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!number || !name || !company) {
      toast({ variant: 'destructive', title: 'Error', description: 'Se requiere número, nombre y empresa.' });
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
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={!company}>
          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Manualmente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir Rápido Empleado a {company?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label>Empresa</label>
            <Input value={company?.name} readOnly disabled />
          </div>
          <div className="space-y-2">
            <label>Número de Empleado</label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <label>Nombre Completo</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <label>Monto de Pago (si aplica)</label>
            <Input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Añadir Empleado</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ConsumptionChart: FC<{ consumptions: Consumption[] | null }> = ({ consumptions }) => {
  const timeZone = 'America/Mexico_City';

  const chartData = useMemo(() => {
    if (!consumptions) return [];
    const dailyConsumptions: { [key: string]: number } = {};

    const lastActiveDays = [
      ...new Set(consumptions.map((c) => formatInTimeZone(new Date(c.timestamp), timeZone, 'yyyy-MM-dd'))),
    ]
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .slice(0, 10);

    consumptions.forEach((c) => {
      if (!c.voided) {
        const day = formatInTimeZone(new Date(c.timestamp), timeZone, 'yyyy-MM-dd');
        if (lastActiveDays.includes(day)) {
          dailyConsumptions[day] = (dailyConsumptions[day] || 0) + 1;
        }
      }
    });

    return Object.keys(dailyConsumptions)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((day) => ({
        name: format(toDate(day, { timeZone }), 'MMM dd', { locale: es }),
        total: dailyConsumptions[day],
      }));
  }, [consumptions, timeZone]);

  const stats = useMemo(() => {
    if (!consumptions || !chartData) return { total: 0, avg: 0, peakDay: 'N/A', peakTotal: 0 };

    const monthlyTotal = consumptions.filter((c) => !c.voided).length;
    const nowInMexicoCity = toZonedTime(new Date(), timeZone);
    const dayOfMonth = getDate(nowInMexicoCity);

    const dailyAvg = dayOfMonth > 0 ? monthlyTotal / dayOfMonth : 0;

    const peak = chartData.reduce(
      (max, item) => (item.total > max.total ? item : max),
      { name: 'N/A', total: 0 }
    );

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
      <EmptyState
        icon={ClipboardList}
        title="No hay registros para este período."
      />
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
              <XAxis
                dataKey="name"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  borderColor: 'hsl(var(--border))',
                  fontSize: '12px',
                  borderRadius: '0.5rem',
                  boxShadow:
                    '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
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
