
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Logo } from '@/components/logo';
import { type Company } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { app, firestore } = useFirebase();

  const [companyId, setCompanyId] = useState<string>("");
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (app) {
      const auth = getAuth(app);
      signInAnonymously(auth)
        .then(() => setIsAuthenticated(true))
        .catch((error) => console.error("Anonymous auth failed:", error));
    }
  }, [app]);

  const companiesQuery = useMemoFirebase(() => 
    firestore ? collection(firestore, 'companies') : null
  , [firestore]);
  const { data: companies, isLoading } = useCollection<Company>(companiesQuery);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const company = companies?.find(c => c.id === companyId);

    if (!company) {
      setError("Por favor seleccione una empresa.");
      return;
    }

    if (company.accessCode === accessCode) {
      localStorage.setItem('companyId', company.id);
      router.push('/');
    } else {
      setError("El código de acceso es incorrecto.");
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: "El código de acceso proporcionado es incorrecto.",
      });
    }
  };

  if (!isAuthenticated) {
      return (
          <div className="flex h-screen items-center justify-center">
              <p>Conectando...</p>
          </div>
      )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Logo />
            </div>
          <CardTitle className="text-2xl">Bienvenido</CardTitle>
          <CardDescription>Ingrese el código de acceso de su empresa para continuar</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Select onValueChange={setCompanyId} value={companyId} disabled={isLoading}>
                    <SelectTrigger id="company">
                        <SelectValue placeholder={isLoading ? "Cargando empresas..." : "Seleccione una empresa"} />
                    </SelectTrigger>
                    <SelectContent>
                        {companies?.map(company => (
                            <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="access-code">Código de Acceso</Label>
                <Input
                id="access-code"
                type="password"
                placeholder="Introduzca su código de acceso"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                required
                />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            </CardContent>
            <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading || !companyId}>
                    {isLoading ? "Cargando..." : "Acceder"}
                </Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
