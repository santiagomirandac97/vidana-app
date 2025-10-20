
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { AlertCircle } from 'lucide-react';
import { useFirebase } from '@/firebase';

// User-facing access codes
const userAccessCodes: Record<string, string> = {
  'INDITEX2024': 'Inditex',
  'AXO2024': 'Grupo Axo',
  'VIDANA2024': 'Vidana',
};

// Internal Firebase credentials
const firebaseCredentials: Record<string, { email: string, pass: string }> = {
  'Inditex': { email: 'inditex@rgstr.app', pass: 'AIFACOM01' },
  'Grupo Axo': { email: 'grupoaxo@rgstr.app', pass: 'TOREOCOM01' },
  'Vidana': { email: 'vidana@rgstr.app', pass: 'PLAZAVIDANA01' },
};


export default function LoginPage() {
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { app } = useFirebase();

  useEffect(() => {
    if (localStorage.getItem('companyId')) {
      router.push('/');
    }
  }, [router]);

  const handleLogin = async () => {
    if (!app) {
      setError('Firebase no está inicializado. Por favor, recargue la página.');
      return;
    }
    setIsLoading(true);
    setError(null);

    const upperCaseAccessCode = accessCode.toUpperCase();
    const companyId = userAccessCodes[upperCaseAccessCode];

    if (!companyId) {
      setError('Código de acceso incorrecto. Por favor, inténtelo de nuevo.');
      setIsLoading(false);
      return;
    }
    
    const credentials = firebaseCredentials[companyId];
    if (!credentials) {
       setError('Credenciales de la empresa no encontradas. Contacte a soporte.');
       setIsLoading(false);
       return;
    }

    const auth = getAuth(app);

    try {
      await signInWithEmailAndPassword(auth, credentials.email, credentials.pass);
      localStorage.setItem('companyId', companyId);
      router.push('/');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, credentials.email, credentials.pass);
          await signInWithEmailAndPassword(auth, credentials.email, credentials.pass);
          localStorage.setItem('companyId', companyId);
          router.push('/');
        } catch (createErr: any) {
          console.error("Firebase creation error:", createErr);
          setError(`Error al configurar la cuenta: ${createErr.message}`);
        }
      } else {
         console.error("Firebase sign-in error:", err);
         setError(`Error de inicio de sesión: ${err.message}.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl">Acceso de Empresas</CardTitle>
          <CardDescription>Ingrese su código de acceso para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="access-code">Código de Acceso</label>
              <Input
                id="access-code"
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Ingrese su código"
                className="text-base h-11"
              />
            </div>
            {error && (
              <div className="mt-4 p-3 rounded-md flex items-center gap-2 text-base bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">{error}</span>
              </div>
            )}
            <Button onClick={handleLogin} className="w-full h-11 text-base" disabled={isLoading || !app}>
              {isLoading ? 'Verificando...' : 'Entrar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
