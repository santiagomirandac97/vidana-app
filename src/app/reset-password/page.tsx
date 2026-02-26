
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

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
        } catch (err: any) {
            let friendlyMessage = 'Ocurrió un error al restablecer la contraseña.';
            if (err.code === 'auth/invalid-action-code') {
                friendlyMessage = 'El enlace ha expirado o ya ha sido utilizado.';
            }
            setError(friendlyMessage);
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-3 text-lg">Verificando enlace...</p>
            </div>
        );
    }

    if (success) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
                 <Card className="w-full max-w-md mx-4 shadow-card text-center">
                    <CardHeader>
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                             <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl mt-4">¡Éxito!</CardTitle>
                        <CardDescription>Tu contraseña ha sido cambiada. Serás redirigido a la página de inicio de sesión.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    if (error && !isSubmitting) {
         return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
                 <Card className="w-full max-w-md mx-4 shadow-card text-center">
                    <CardHeader>
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                             <XCircle className="h-8 w-8 text-red-600" />
                        </div>
                        <CardTitle className="text-2xl mt-4">Enlace no Válido</CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full">
                            <Link href="/login">Volver a Inicio de Sesión</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }


    return (
        <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
            <Card className="w-full max-w-md mx-4 shadow-card hover:shadow-card-hover transition-shadow">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4">
                        <Logo />
                    </div>
                    <CardTitle className="text-2xl">Restablecer Contraseña</CardTitle>
                    <CardDescription>Ingrese su nueva contraseña a continuación.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            type="password"
                            placeholder="Nueva Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 h-12 text-lg"
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
                            className="pl-10 h-12 text-lg"
                            disabled={isSubmitting}
                        />
                    </div>
                    {error && <p className="text-sm text-red-500 px-1">{error}</p>}
                    <Button onClick={handleResetPassword} className="w-full h-12 text-lg" disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cambiando...</> : 'Establecer Nueva Contraseña'}
                    </Button>
                </CardContent>
            </Card>
        </div>
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
  )
}

    