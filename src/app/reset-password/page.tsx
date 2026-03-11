
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

function GradientShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
            <div
                className="absolute inset-0"
                style={{
                    background: 'linear-gradient(135deg, hsl(224, 76%, 48%) 0%, hsl(230, 72%, 32%) 50%, hsl(235, 80%, 18%) 100%)',
                }}
            />
            <div
                className="absolute -top-32 -right-32 h-[600px] w-[600px] rounded-full opacity-30"
                style={{
                    background: 'radial-gradient(circle, hsl(210, 100%, 70%) 0%, transparent 70%)',
                }}
            />
            <div
                className="absolute -bottom-48 -left-48 h-[500px] w-[500px] rounded-full opacity-15"
                style={{
                    background: 'radial-gradient(circle, hsl(250, 80%, 65%) 0%, transparent 70%)',
                }}
            />
            {children}
            <div className="absolute bottom-6 left-0 right-0 text-center">
                <p className="text-sm text-white/50">Gestión de comedores empresariales · Vidana</p>
            </div>
        </div>
    );
}

function ResetPasswordContent() {
    const auth = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const oobCode = searchParams.get('oobCode');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!auth) return;

        if (!oobCode) {
            setError('El enlace de restablecimiento no es válido o ha expirado. Por favor, intente de nuevo.');
            setIsLoading(false);
            return;
        }

        verifyPasswordResetCode(auth, oobCode)
            .then(() => {
                setIsLoading(false);
            })
            .catch(() => {
                setError('El enlace de restablecimiento no es válido o ha expirado. Por favor, intente de nuevo.');
                setIsLoading(false);
            });
    }, [oobCode, auth]);

    const handleResetPassword = async () => {
        if (!auth || !oobCode) return;

        if (!password || !confirmPassword) {
            setError('Por favor, complete todos los campos.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await confirmPasswordReset(auth, oobCode, password);
            setSuccess(true);
            toast({
                title: 'Contraseña Restablecida',
                description: 'Su contraseña ha sido actualizada exitosamente. Ahora puede iniciar sesión.',
            });
            setTimeout(() => router.push('/login'), 3000);
        } catch (err: unknown) {
            let friendlyMessage = 'Ocurrió un error al restablecer la contraseña.';
            const fbErr = err as { code?: string };
            if (fbErr.code === 'auth/invalid-action-code') {
                friendlyMessage = 'El enlace ha expirado o ya ha sido utilizado.';
            }
            setError(friendlyMessage);
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <p className="ml-3 text-lg text-white">Verificando enlace...</p>
            </div>
        );
    }

    if (success) {
        return (
            <GradientShell>
                <div className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] sm:p-10 text-center">
                    <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mb-6">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">¡Éxito!</h2>
                    <p className="text-sm text-gray-500">Tu contraseña ha sido cambiada. Serás redirigido a la página de inicio de sesión.</p>
                </div>
            </GradientShell>
        );
    }

    if (error && !isSubmitting) {
        return (
            <GradientShell>
                <div className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] sm:p-10 text-center">
                    <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100 mb-6">
                        <XCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Enlace no Válido</h2>
                    <p className="text-sm text-gray-500 mb-6">{error}</p>
                    <Button asChild className="w-full h-12 text-base">
                        <Link href="/login">Volver a Inicio de Sesión</Link>
                    </Button>
                </div>
            </GradientShell>
        );
    }

    return (
        <GradientShell>
            <div className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] sm:p-10">
                <div className="mb-8 flex justify-center">
                    <Logo />
                </div>

                <h2 className="text-center text-2xl font-semibold tracking-tight text-gray-900 mb-1">Restablecer Contraseña</h2>
                <p className="text-center text-sm text-gray-500 mb-8">Ingrese su nueva contraseña a continuación.</p>

                <div className="space-y-4">
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            type="password"
                            placeholder="Nueva Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 h-12 text-base bg-gray-50 border-gray-200 focus:bg-white"
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            type="password"
                            placeholder="Confirmar Nueva Contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                            className="pl-10 h-12 text-base bg-gray-50 border-gray-200 focus:bg-white"
                            disabled={isSubmitting}
                        />
                    </div>
                    {error && <p className="text-sm text-red-500 px-1">{error}</p>}
                    <Button onClick={handleResetPassword} className="w-full h-12 text-base" disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cambiando...</> : 'Establecer Nueva Contraseña'}
                    </Button>
                </div>
            </div>
        </GradientShell>
    );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-3 text-lg">Cargando...</p>
    </div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
