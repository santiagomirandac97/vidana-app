
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
import { useToast } from '@/hooks/use-toast';
import { COMPANIES } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';


const companyCredentials = {
  'Inditex': { email: 'inditex@rgstr.app', password: 'AIFACOM01' },
  'Grupo Axo': { email: 'grupoaxo@rgstr.app', password: 'TOREOCOM01' },
};

export default function LoginPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('Inditex');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

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
    
    if (password !== credentials.password) {
        setError('Contraseña incorrecta. Por favor, inténtelo de nuevo.');
        setIsLoading(false);
        return;
    }

    try {
      // We will sign in with pre-configured emails to represent company logins
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      router.push('/');
    } catch (err: any) {
      console.error(err);
       if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
         // This is a setup issue. Let's try to create the user.
         try {
            await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
            // Now try signing in again
            await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
            router.push('/');
         } catch (setupError: any) {
            setError('Error de configuración de la cuenta. Contacte al administrador.');
            console.error("Account setup error:", setupError);
         }
       } else {
        setError('Ocurrió un error inesperado durante el inicio de sesión.');
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
