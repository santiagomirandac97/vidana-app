
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Logo } from '@/components/logo';
import { COMPANIES } from '@/lib/types';
import { AlertCircle } from 'lucide-react';

const companyCredentials = {
  'Inditex': { email: 'inditex@rgstr.app', password: 'AIFACOM01', userPassword: 'AIFACOM01' },
  'Grupo Axo': { email: 'grupoaxo@rgstr.app', password: 'TOREOCOM01', userPassword: 'Toreo' },
};

export default function LoginPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('Inditex');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async () => {
    if (!selectedCompanyId || !password) {
      setError('Por favor, seleccione una empresa e ingrese la contraseña.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const companyKey = selectedCompanyId as keyof typeof companyCredentials;
    const credentials = companyCredentials[companyKey];

    // 1. Check the user-facing password first.
    if (password !== credentials.userPassword) {
        setError('Contraseña incorrecta. Por favor, inténtelo de nuevo.');
        setIsLoading(false);
        return;
    }

    // 2. Try to sign in with the permanent Firebase credentials.
    try {
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      router.push('/');
    } catch (err: any) {
       console.error("Firebase sign-in error:", err);

       // 3. If sign-in fails because the user doesn't exist, create it once.
       if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          try {
             await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
             // After creation, sign in again.
             await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
             router.push('/');
          } catch (createErr: any) {
            console.error("Firebase user creation failed after initial sign-in failure:", createErr);
            setError('Error de configuración de la cuenta. Contacte al administrador.');
          }
       } else {
            // For any other errors (network, etc.), show a generic message.
            setError('Ocurrió un error inesperado al iniciar sesión.');
       }
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading || user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
          <CardDescription>Seleccione su empresa e ingrese la contraseña para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <label>Empresa</label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="w-full text-base h-11">
                  <SelectValue placeholder="Seleccionar Empresa" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANIES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="password">Contraseña</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="************"
                className="text-base h-11"
              />
            </div>
            {error && (
              <div className="mt-4 p-3 rounded-md flex items-center gap-2 text-base bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">{error}</span>
              </div>
            )}
            <Button onClick={handleLogin} className="w-full h-11 text-base" disabled={isLoading}>
              {isLoading ? 'Iniciando Sesión...' : 'Entrar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
