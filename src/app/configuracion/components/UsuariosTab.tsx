'use client';

import { useState, type FC } from 'react';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, orderBy, updateDoc, deleteField, addDoc, limit } from 'firebase/firestore';
import { type Company, type UserProfile, type UserInvite } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, ChevronDown, Link2, Copy, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';

export const UsuariosTab: FC = () => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { user: currentUser } = useUser();

    const usersQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'users'), orderBy('name')) : null,
    [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);

    const companiesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null,
    [firestore]);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

    const invitesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'invites'), orderBy('createdAt', 'desc'), limit(10)) : null,
    [firestore]);
    const { data: invites, isLoading: invitesLoading } = useCollection<UserInvite>(invitesQuery);

    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

    const handleRoleChange = (user: UserProfile, newRole: 'admin' | 'user') => {
        if (!firestore) return;
        if (user.uid === currentUser?.uid) {
            toast({ variant: 'destructive', title: 'Error', description: 'No puede cambiar su propio rol.' });
            return;
        }

        const userDocRef = doc(firestore, 'users', user.uid);
        updateDoc(userDocRef, { role: newRole })
            .then(() => {
                toast({ title: 'Rol Actualizado', description: `El rol de ${user.name} ha sido cambiado a ${newRole}.` });
            })
            .catch((error: unknown) => {
                toast({ variant: 'destructive', title: 'Error al actualizar rol', description: error instanceof Error ? error.message : 'Error desconocido' });
            });
    };

    const handleCompanyChange = (user: UserProfile, newCompanyId: string | null) => {
        if (!firestore) return;
        if (user.uid === currentUser?.uid) {
            toast({ variant: 'destructive', title: 'Error', description: 'No puede cambiar su propia empresa asignada.' });
            return;
        }

        const userDocRef = doc(firestore, 'users', user.uid);
        const updatePayload = newCompanyId
            ? { companyId: newCompanyId }
            : { companyId: deleteField() };

        updateDoc(userDocRef, updatePayload)
            .then(() => {
                const companyName = newCompanyId
                    ? companies?.find(c => c.id === newCompanyId)?.name ?? newCompanyId
                    : null;
                toast({
                    title: 'Empresa Actualizada',
                    description: companyName
                        ? `${user.name} fue asignado a ${companyName}.`
                        : `${user.name} ya no tiene empresa asignada.`,
                });
            })
            .catch((error: unknown) => {
                toast({ variant: 'destructive', title: 'Error al actualizar empresa', description: error instanceof Error ? error.message : 'Error desconocido' });
            });
    };

    const isLoading = usersLoading || companiesLoading;

    return (
        <div className="space-y-6">
            <Card className="shadow-card hover:shadow-card-hover transition-shadow">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Gestionar Usuarios</CardTitle>
                    <CardDescription>Vea y gestione los roles y empresas de los usuarios registrados en el sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex h-64 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : !users || users.length === 0 ? (
                        <EmptyState icon={Users} title="No hay miembros en el equipo." />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Empresa Asignada</TableHead>
                                    <TableHead className="text-center">Rol Actual</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users?.map(user => {
                                    const assignedCompany = companies?.find(c => c.id === user.companyId);
                                    const isSelf = user.uid === currentUser?.uid;
                                    return (
                                        <TableRow key={user.uid}>
                                            <TableCell className="font-medium">{user.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{user.email}</TableCell>
                                            <TableCell>
                                                {assignedCompany ? (
                                                    <span className="text-sm">{assignedCompany.name}</span>
                                                ) : (
                                                    <StatusBadge variant="warning" label="Sin empresa" />
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {user.role}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Company assignment dropdown */}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" size="sm" disabled={isSelf}>
                                                                Empresa <ChevronDown className="ml-1 h-3 w-3" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onSelect={() => handleCompanyChange(user, null)}
                                                                disabled={!user.companyId}
                                                            >
                                                                Sin empresa
                                                            </DropdownMenuItem>
                                                            {companies?.map(company => (
                                                                <DropdownMenuItem
                                                                    key={company.id}
                                                                    onSelect={() => handleCompanyChange(user, company.id)}
                                                                    disabled={user.companyId === company.id}
                                                                >
                                                                    {company.name}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    {/* Role change dropdown */}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" size="sm" disabled={isSelf}>
                                                                Rol <ChevronDown className="ml-1 h-3 w-3" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onSelect={() => handleRoleChange(user, 'admin')} disabled={user.role === 'admin'}>
                                                                Hacer Administrador
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => handleRoleChange(user, 'user')} disabled={user.role === 'user'}>
                                                                Hacer Usuario
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
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

            {/* Section A — Generate Invite */}
            <Card className="shadow-card hover:shadow-card-hover transition-shadow">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Invitaciones</CardTitle>
                            <CardDescription>Genere enlaces de invitación para nuevos usuarios.</CardDescription>
                        </div>
                        <Button onClick={() => setInviteDialogOpen(true)}>
                            <Link2 className="mr-2 h-4 w-4" />
                            Generar Invitación
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Section B — Invite history */}
                    {invitesLoading ? (
                        <div className="flex h-32 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : !invites || invites.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No hay invitaciones generadas aún.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Expira</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invites.map(invite => {
                                    const company = companies?.find(c => c.id === invite.companyId);
                                    const isExpired = new Date(invite.expiresAt) < new Date();
                                    const status = invite.used ? 'used' : isExpired ? 'expired' : 'pending';
                                    return (
                                        <TableRow key={invite.id}>
                                            <TableCell className="font-medium">{company?.name ?? invite.companyId}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${invite.role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {invite.role}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{invite.email || '—'}</TableCell>
                                            <TableCell className="font-mono text-xs">{new Date(invite.expiresAt).toLocaleDateString('es-MX')}</TableCell>
                                            <TableCell>
                                                {status === 'used' && <StatusBadge variant="success" label="Usado" />}
                                                {status === 'expired' && <StatusBadge variant="error" label="Expirado" />}
                                                {status === 'pending' && <StatusBadge variant="pendiente" label="Pendiente" />}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Generate Invite Dialog */}
            {companies && (
                <GenerateInviteDialog
                    isOpen={inviteDialogOpen}
                    onClose={() => setInviteDialogOpen(false)}
                    companies={companies}
                    currentUserId={currentUser?.uid ?? ''}
                />
            )}
        </div>
    );
};


// =================================================================
// Generate Invite Dialog
// =================================================================

interface GenerateInviteDialogProps {
    isOpen: boolean;
    onClose: () => void;
    companies: Company[];
    currentUserId: string;
}

const GenerateInviteDialog: FC<GenerateInviteDialogProps> = ({ isOpen, onClose, companies, currentUserId }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedRole, setSelectedRole] = useState<'admin' | 'user'>('user');
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleClose = () => {
        setSelectedCompanyId('');
        setSelectedRole('user');
        setEmail('');
        setGeneratedLink(null);
        setCopied(false);
        onClose();
    };

    const handleGenerate = async () => {
        if (!firestore || !selectedCompanyId) return;

        setIsSubmitting(true);
        try {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            const inviteData: Omit<UserInvite, 'id'> = {
                companyId: selectedCompanyId,
                role: selectedRole,
                createdBy: currentUserId,
                createdAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                used: false,
                ...(email.trim() ? { email: email.trim() } : {}),
            };

            const docRef = await addDoc(collection(firestore, 'invites'), inviteData);
            const link = `${window.location.origin}/signup?invite=${docRef.id}`;
            setGeneratedLink(link);
            toast({ title: 'Invitación creada', description: 'El enlace de invitación ha sido generado.' });
        } catch (error: unknown) {
            toast({ variant: 'destructive', title: 'Error al generar invitación', description: error instanceof Error ? error.message : 'Error desconocido' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = async () => {
        if (!generatedLink) return;
        await navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        toast({ title: '¡Enlace copiado!', description: 'El enlace ha sido copiado al portapapeles.' });
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Generar Invitación</DialogTitle>
                    <DialogDescription>Cree un enlace de invitación de un solo uso para un nuevo usuario.</DialogDescription>
                </DialogHeader>

                {!generatedLink ? (
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Empresa</label>
                            <Select onValueChange={setSelectedCompanyId} value={selectedCompanyId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione una empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {companies.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Rol</label>
                            <Select onValueChange={(v) => setSelectedRole(v as 'admin' | 'user')} value={selectedRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">Usuario</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email (opcional)</label>
                            <Input
                                type="email"
                                placeholder="correo@empresa.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="ghost">Cancelar</Button>
                            </DialogClose>
                            <Button onClick={handleGenerate} disabled={isSubmitting || !selectedCompanyId}>
                                {isSubmitting ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...</>
                                ) : (
                                    <><Link2 className="mr-2 h-4 w-4" /> Generar enlace</>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-muted-foreground">Comparte este enlace con el nuevo usuario. Expira en 7 días y solo puede usarse una vez.</p>
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={generatedLink}
                                className="font-mono text-xs"
                            />
                            <Button variant="outline" size="icon" onClick={handleCopy}>
                                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleClose}>Cerrar</Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
