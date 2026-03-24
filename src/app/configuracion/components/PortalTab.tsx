'use client';

import { useState, useCallback, type FC, type KeyboardEvent } from 'react';
import { useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { type Company } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X } from 'lucide-react';
import { SkeletonTable } from '@/components/ui/skeleton-layouts';
import { MenuScheduleManager } from './MenuScheduleManager';

const PAYMENT_OPTIONS = [
    { value: 'nomina' as const, label: 'Nomina' },
    { value: 'efectivo' as const, label: 'Efectivo' },
    { value: 'tarjeta' as const, label: 'Tarjeta' },
    { value: 'transferencia' as const, label: 'Transferencia' },
];

export const PortalTab: FC<{ companies: Company[] | null; companiesLoading: boolean }> = ({ companies, companiesLoading }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [saving, setSaving] = useState(false);

    // Local form state
    const [orderPortalEnabled, setOrderPortalEnabled] = useState(false);
    const [allowedCustomerDomains, setAllowedCustomerDomains] = useState<string[]>([]);
    const [domainInput, setDomainInput] = useState('');
    const [paymentMethods, setPaymentMethods] = useState<('nomina' | 'efectivo' | 'tarjeta' | 'transferencia')[]>([]);
    const [takeAwayEnabled, setTakeAwayEnabled] = useState(false);

    // Fetch the selected company document
    const companyDocRef = useMemoFirebase(() =>
        firestore && selectedCompanyId ? doc(firestore, `companies/${selectedCompanyId}`) : null
    , [firestore, selectedCompanyId]);
    const { data: companyDoc, isLoading: companyDocLoading } = useDoc<Company>(companyDocRef);

    // Sync local state when company doc loads or changes
    const [lastSyncedId, setLastSyncedId] = useState<string | null>(null);
    if (companyDoc && companyDoc.id !== lastSyncedId) {
        setLastSyncedId(companyDoc.id);
        setOrderPortalEnabled(companyDoc.orderPortalEnabled ?? false);
        setAllowedCustomerDomains(companyDoc.allowedCustomerDomains ?? []);
        setPaymentMethods(companyDoc.paymentMethods ?? []);
        setTakeAwayEnabled(companyDoc.takeAwayEnabled ?? false);
    }

    // Reset local state when company selection cleared
    if (!selectedCompanyId && lastSyncedId) {
        setLastSyncedId(null);
        setOrderPortalEnabled(false);
        setAllowedCustomerDomains([]);
        setPaymentMethods([]);
        setTakeAwayEnabled(false);
    }

    const handleAddDomain = useCallback(() => {
        const domain = domainInput.trim().toLowerCase();
        if (!domain) return;
        if (allowedCustomerDomains.includes(domain)) {
            setDomainInput('');
            return;
        }
        setAllowedCustomerDomains(prev => [...prev, domain]);
        setDomainInput('');
    }, [domainInput, allowedCustomerDomains]);

    const handleRemoveDomain = useCallback((domain: string) => {
        setAllowedCustomerDomains(prev => prev.filter(d => d !== domain));
    }, []);

    const handleDomainKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddDomain();
        }
    }, [handleAddDomain]);

    const togglePaymentMethod = useCallback((method: 'nomina' | 'efectivo' | 'tarjeta' | 'transferencia') => {
        setPaymentMethods(prev =>
            prev.includes(method)
                ? prev.filter(m => m !== method)
                : [...prev, method]
        );
    }, []);

    const handleSave = useCallback(async () => {
        if (!firestore || !selectedCompanyId) return;
        setSaving(true);
        try {
            const companyRef = doc(firestore, `companies/${selectedCompanyId}`);
            await updateDoc(companyRef, {
                orderPortalEnabled,
                allowedCustomerDomains,
                paymentMethods,
                takeAwayEnabled,
            });
            toast({ title: 'Configuracion guardada', description: 'Los ajustes del portal fueron actualizados.' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error al guardar', description: err.message });
        } finally {
            setSaving(false);
        }
    }, [firestore, selectedCompanyId, orderPortalEnabled, allowedCustomerDomains, paymentMethods, takeAwayEnabled, toast]);

    if (companiesLoading) {
        return (
            <div className="py-4">
                <SkeletonTable rows={4} cols={3} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Company selector */}
            <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="Seleccionar empresa" />
                    </SelectTrigger>
                    <SelectContent>
                        {(companies ?? []).map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedCompanyId && companyDocLoading && (
                <div className="py-4">
                    <SkeletonTable rows={4} cols={2} />
                </div>
            )}

            {selectedCompanyId && !companyDocLoading && companyDoc && (
                <Card className="rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200">
                    <CardHeader>
                        <CardTitle>Portal de Ordenes</CardTitle>
                        <CardDescription>Configuracion del portal de pedidos para {companyDoc.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Order portal toggle */}
                        <div className="flex items-center justify-between">
                            <Label htmlFor="orderPortalEnabled">Activar portal de ordenes</Label>
                            <Switch
                                id="orderPortalEnabled"
                                checked={orderPortalEnabled}
                                onCheckedChange={setOrderPortalEnabled}
                            />
                        </div>

                        {/* Allowed customer domains */}
                        <div className="space-y-2">
                            <Label>Dominios permitidos</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="ejemplo.com"
                                    value={domainInput}
                                    onChange={e => setDomainInput(e.target.value)}
                                    onKeyDown={handleDomainKeyDown}
                                    className="max-w-xs"
                                />
                                <Button type="button" variant="outline" size="sm" onClick={handleAddDomain}>
                                    Agregar
                                </Button>
                            </div>
                            {allowedCustomerDomains.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {allowedCustomerDomains.map(domain => (
                                        <span
                                            key={domain}
                                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                                        >
                                            {domain}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveDomain(domain)}
                                                className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Payment methods */}
                        <div className="space-y-3">
                            <Label>Metodos de pago</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {PAYMENT_OPTIONS.map(opt => (
                                    <div key={opt.value} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`payment-${opt.value}`}
                                            checked={paymentMethods.includes(opt.value)}
                                            onCheckedChange={() => togglePaymentMethod(opt.value)}
                                        />
                                        <Label htmlFor={`payment-${opt.value}`} className="font-normal cursor-pointer">
                                            {opt.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Take-away toggle */}
                        <div className="flex items-center justify-between">
                            <Label htmlFor="takeAwayEnabled">Permitir ordenes para llevar</Label>
                            <Switch
                                id="takeAwayEnabled"
                                checked={takeAwayEnabled}
                                onCheckedChange={setTakeAwayEnabled}
                            />
                        </div>

                        {/* Save button */}
                        <div className="pt-2">
                            <Button onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {selectedCompanyId && !companyDocLoading && companyDoc && orderPortalEnabled && (
                <MenuScheduleManager companyId={selectedCompanyId} />
            )}
        </div>
    );
};
