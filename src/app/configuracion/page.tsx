'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type FC } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, orderBy, addDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { type Company, type UserProfile, type RfidDevice } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AppShell, PageHeader } from '@/components/layout';
import { Loader2, ShieldAlert, Home, PlusCircle, Edit, CheckCircle2, XCircle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { EmpresasTab } from './components/EmpresasTab';
import { MenuTab } from './components/MenuTab';
import { UsuariosTab } from './components/UsuariosTab';

const TABS = [
    { value: 'companies', label: 'Gestionar Empresas' },
    { value: 'menus', label: 'Gestionar Menús' },
    { value: 'users', label: 'Gestionar Usuarios' },
    { value: 'rfid', label: 'Dispositivos RFID' },
];

export default function ConfiguracionPage() {
    const { user, isLoading: userLoading } = useUser();
    const router = useRouter();
    const { firestore } = useFirebase();

    const userProfileRef = useMemoFirebase(() =>
        firestore && user ? doc(firestore, `users/${user.uid}`) : null
    , [firestore, user]);
    const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

    const isLoading = userLoading || profileLoading || (!!user && !userProfile);

    useEffect(() => {
        if (!isLoading && !user) {
            router.replace('/login');
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <AppShell>
                <div className="flex h-screen w-full items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin" />
                    <p className="ml-4 text-lg">Verificando acceso de administrador...</p>
                </div>
            </AppShell>
        );
    }

    if (userProfile?.role !== 'admin') {
         return (
            <AppShell>
                <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
                    <Card className="w-full max-w-sm mx-4 shadow-xl text-center">
                        <CardHeader>
                            <CardTitle className="flex flex-col items-center gap-2">
                                <ShieldAlert className="h-12 w-12 text-destructive" />
                                Acceso Denegado
                            </CardTitle>
                            <CardDescription>No tiene los permisos necesarios para ver esta página.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.push('/selection')} className="w-full">
                                <Home className="mr-2 h-4 w-4" />
                                Volver al Inicio
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <ConfiguracionDashboard />
        </AppShell>
    );
}

const ConfiguracionDashboard: FC = () => {
    const { firestore } = useFirebase();
    const [activeTab, setActiveTab] = useState('companies');

    const companiesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null
    , [firestore]);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            <PageHeader title="Configuración" subtitle="Empresas, menús y usuarios" />
            <div className="flex gap-8">
                {/* Vertical nav list */}
                <div className="w-44 shrink-0">
                    <nav className="space-y-1">
                        {TABS.map(tab => (
                            <button
                                key={tab.value}
                                onClick={() => setActiveTab(tab.value)}
                                className={cn(
                                    'w-full text-left px-3 py-2 text-sm rounded-md transition-colors border-l-2',
                                    activeTab === tab.value
                                        ? 'bg-primary/5 text-primary font-medium border-primary pl-[10px]'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground border-transparent pl-[10px]'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
                {/* Content area */}
                <div className="flex-1 min-w-0">
                    <div className={activeTab === 'companies' ? 'block' : 'hidden'}>
                        <EmpresasTab companies={companies} companiesLoading={companiesLoading} />
                    </div>
                    <div className={activeTab === 'menus' ? 'block' : 'hidden'}>
                        <MenuTab companies={companies} companiesLoading={companiesLoading} />
                    </div>
                    <div className={activeTab === 'users' ? 'block' : 'hidden'}>
                        <UsuariosTab />
                    </div>
                    <div className={activeTab === 'rfid' ? 'block' : 'hidden'}>
                        <RfidTab companies={companies} companiesLoading={companiesLoading} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── RFID Devices Tab ────────────────────────────────────────────────────────

const IP_REGEX = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

function isDeviceOnline(lastSeen?: string): boolean {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff <= 5 * 60 * 1000; // 5 minutes
}

function formatLastSeen(lastSeen?: string): string {
    if (!lastSeen) return 'Nunca';
    const date = new Date(lastSeen);
    return date.toLocaleString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

type DeviceWithCompanyName = RfidDevice & { id: string; companyName: string };

const RfidTab: FC<{ companies: Company[] | null; companiesLoading: boolean }> = ({ companies, companiesLoading }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingDevice, setEditingDevice] = useState<DeviceWithCompanyName | null>(null);

    // Form state
    const [formCompanyId, setFormCompanyId] = useState('');
    const [formName, setFormName] = useState('');
    const [formIp, setFormIp] = useState('');
    const [formType, setFormType] = useState<'idemia-morphoaccess'>('idemia-morphoaccess');
    const [saving, setSaving] = useState(false);

    // Connection test state
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

    // Load devices for each company
    const [allDevices, setAllDevices] = useState<DeviceWithCompanyName[]>([]);
    const [devicesLoading, setDevicesLoading] = useState(true);

    // Stable key derived from company IDs to avoid listener churn
    const companyIds = useMemo(() => companies?.map(c => c.id).join(',') ?? '', [companies]);
    const companiesRef = useRef(companies);
    companiesRef.current = companies;

    // We need individual queries per company — use a combined approach
    // Since useCollection requires memoized queries and we can't call hooks in a loop,
    // we'll use a useEffect with onSnapshot for each company
    useEffect(() => {
        const currentCompanies = companiesRef.current;
        if (!firestore || !currentCompanies || currentCompanies.length === 0) {
            setAllDevices([]);
            setDevicesLoading(false);
            return;
        }

        setDevicesLoading(true);
        const unsubscribes: (() => void)[] = [];
        const devicesByCompany: Record<string, DeviceWithCompanyName[]> = {};

        for (const company of currentCompanies) {
            const colRef = collection(firestore, `companies/${company.id}/rfidDevices`);
            const unsub = onSnapshot(
                colRef,
                (snapshot) => {
                    devicesByCompany[company.id] = snapshot.docs.map((d) => ({
                        ...(d.data() as RfidDevice),
                        id: d.id,
                        companyName: company.name,
                    }));
                    // Merge all
                    const merged = Object.values(devicesByCompany).flat();
                    setAllDevices(merged);
                    setDevicesLoading(false);
                },
                (error) => {
                    console.error(`RFID devices listener error for ${company.name}:`, error);
                    setDevicesLoading(false);
                }
            );
            unsubscribes.push(unsub);
        }

        return () => unsubscribes.forEach(u => u());
    }, [firestore, companyIds]);

    const openAddDialog = useCallback(() => {
        setEditingDevice(null);
        setFormCompanyId(companies?.[0]?.id ?? '');
        setFormName('');
        setFormIp('');
        setFormType('idemia-morphoaccess');
        setTestStatus('idle');
        setDialogOpen(true);
    }, [companies]);

    const openEditDialog = useCallback((device: DeviceWithCompanyName) => {
        setEditingDevice(device);
        setFormCompanyId(device.companyId);
        setFormName(device.name);
        setFormIp(device.ipAddress);
        setFormType(device.type);
        setTestStatus('idle');
        setDialogOpen(true);
    }, []);

    const testConnection = useCallback(async () => {
        if (!formIp || !IP_REGEX.test(formIp)) {
            toast({ title: 'IP inválida', description: 'Ingrese una dirección IP válida.', variant: 'destructive' });
            return;
        }
        setTestStatus('testing');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
            await fetch(`http://${formIp}/`, { signal: controller.signal, mode: 'no-cors' });
            clearTimeout(timeout);
            setTestStatus('success');
        } catch {
            clearTimeout(timeout);
            setTestStatus('error');
        }
    }, [formIp, toast]);

    const handleSave = useCallback(async () => {
        if (!firestore) return;
        if (!formCompanyId) {
            toast({ title: 'Error', description: 'Seleccione una empresa.', variant: 'destructive' });
            return;
        }
        if (!formName.trim()) {
            toast({ title: 'Error', description: 'Ingrese un nombre para el dispositivo.', variant: 'destructive' });
            return;
        }
        if (!IP_REGEX.test(formIp)) {
            toast({ title: 'IP inválida', description: 'Formato esperado: x.x.x.x', variant: 'destructive' });
            return;
        }

        setSaving(true);
        try {
            const data = {
                name: formName.trim(),
                ipAddress: formIp.trim(),
                type: formType,
                companyId: formCompanyId,
                active: true,
            };

            if (editingDevice) {
                const deviceRef = doc(firestore, `companies/${editingDevice.companyId}/rfidDevices/${editingDevice.id}`);
                await updateDoc(deviceRef, data);
                toast({ title: 'Dispositivo actualizado' });
            } else {
                const colRef = collection(firestore, `companies/${formCompanyId}/rfidDevices`);
                await addDoc(colRef, data);
                toast({ title: 'Dispositivo agregado' });
            }
            setDialogOpen(false);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    }, [firestore, formCompanyId, formName, formIp, formType, editingDevice, toast]);

    const toggleActive = useCallback(async (device: DeviceWithCompanyName) => {
        if (!firestore) return;
        try {
            const deviceRef = doc(firestore, `companies/${device.companyId}/rfidDevices/${device.id}`);
            await updateDoc(deviceRef, { active: !device.active });
            toast({ title: device.active ? 'Dispositivo desactivado' : 'Dispositivo activado' });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    }, [firestore, toast]);

    if (companiesLoading || devicesLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Cargando dispositivos...</span>
            </div>
        );
    }

    return (
        <>
            <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                        <CardTitle>Dispositivos RFID</CardTitle>
                        <CardDescription>Lectores de tarjetas conectados a cada empresa</CardDescription>
                    </div>
                    <Button size="sm" onClick={openAddDialog}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Agregar Dispositivo
                    </Button>
                </CardHeader>
                <CardContent>
                    {allDevices.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No hay dispositivos RFID registrados.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>IP</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Última conexión</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allDevices.map(device => {
                                    const online = isDeviceOnline(device.lastSeen);
                                    return (
                                        <TableRow key={`${device.companyId}-${device.id}`} className={!device.active ? 'opacity-50' : ''}>
                                            <TableCell>{device.companyName}</TableCell>
                                            <TableCell className="font-medium">{device.name}</TableCell>
                                            <TableCell className="font-mono text-sm">{device.ipAddress}</TableCell>
                                            <TableCell className="text-sm">IDEMIA MorphoAccess</TableCell>
                                            <TableCell>
                                                <span className="flex items-center gap-1.5">
                                                    <span className={cn(
                                                        'inline-block h-2.5 w-2.5 rounded-full',
                                                        online ? 'bg-green-500' : 'bg-red-500'
                                                    )} />
                                                    <span className="text-sm">{online ? 'En línea' : 'Sin conexión'}</span>
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">{formatLastSeen(device.lastSeen)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(device)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleActive(device)}
                                                        title={device.active ? 'Desactivar' : 'Activar'}
                                                    >
                                                        {device.active
                                                            ? <WifiOff className="h-4 w-4 text-destructive" />
                                                            : <Wifi className="h-4 w-4 text-green-600" />
                                                        }
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Add / Edit Device Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingDevice ? 'Editar Dispositivo' : 'Agregar Dispositivo RFID'}</DialogTitle>
                        <DialogDescription>
                            {editingDevice ? 'Modifique los datos del dispositivo.' : 'Registre un nuevo lector RFID.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Company */}
                        <div className="space-y-2">
                            <Label>Empresa</Label>
                            <Select value={formCompanyId} onValueChange={setFormCompanyId} disabled={!!editingDevice}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(companies ?? []).map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Name */}
                        <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input
                                placeholder="Ej: IDEMIA Comedor Principal"
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                            />
                        </div>

                        {/* IP Address */}
                        <div className="space-y-2">
                            <Label>Dirección IP</Label>
                            <Input
                                placeholder="192.168.1.10"
                                value={formIp}
                                onChange={e => setFormIp(e.target.value)}
                                className="font-mono"
                            />
                        </div>

                        {/* Device Type */}
                        <div className="space-y-2">
                            <Label>Tipo de Dispositivo</Label>
                            <Select value={formType} onValueChange={(v) => setFormType(v as 'idemia-morphoaccess')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="idemia-morphoaccess">IDEMIA MorphoAccess</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Test Connection */}
                        <div className="flex items-center gap-3">
                            <Button type="button" variant="outline" size="sm" onClick={testConnection} disabled={testStatus === 'testing'}>
                                {testStatus === 'testing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Probar Conexión
                            </Button>
                            {testStatus === 'success' && (
                                <span className="flex items-center gap-1 text-sm text-green-600">
                                    <CheckCircle2 className="h-4 w-4" /> Conexión exitosa
                                </span>
                            )}
                            {testStatus === 'error' && (
                                <span className="flex items-center gap-1 text-sm text-destructive">
                                    <XCircle className="h-4 w-4" /> Sin respuesta
                                </span>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingDevice ? 'Guardar Cambios' : 'Agregar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
