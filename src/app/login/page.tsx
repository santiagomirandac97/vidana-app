
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Logo } from '@/components/logo';
import { COMPANIES } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string>("");
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const company = COMPANIES.find(c => c.id === companyId);

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

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Logo />
            </div>
          <CardTitle className="text-2xl">Bienvenido a RGSTR</CardTitle>
          <CardDescription>Ingrese el código de acceso de su empresa para continuar</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Select onValueChange={setCompanyId} value={companyId}>
                    <SelectTrigger id="company">
                        <SelectValue placeholder="Seleccione una empresa" />
                    </SelectTrigger>
                    <SelectContent>
                        {COMPANIES.map(company => (
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
                <Button type="submit" className="w-full">Acceder</Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
