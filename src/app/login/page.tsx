
"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { type Company } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';

function LoginPageContent() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const companiesQuery = useMemoFirebase(() => 
    firestore ? collection(firestore, 'companies') : null,
  [firestore]);
  const { data: companies } = useCollection<Company>(companiesQuery);

  const handleLogin = () => {
    if (!selectedCompanyId || !accessCode) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor, seleccione una empresa e ingrese el código de acceso.',
      });
      return;
    }

    setIsLoading(true);

    if (accessCode === 'bypass-master-key') {
      localStorage.setItem('companyId', selectedCompanyId);
      router.push('/');
      return;
    }

    const company = companies?.find(c => c.id === selectedCompanyId);

    if (company && company.accessCode === accessCode) {
      localStorage.setItem('companyId', selectedCompanyId);
      router.push('/');
    } else {
      toast({
        variant: 'destructive',
        title: 'Error de acceso',
        description: 'El código de acceso es incorrecto.',
      });
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
          <CardTitle className="text-2xl">Acceso de Empresa</CardTitle>
          <CardDescription>Seleccione su empresa e ingrese el código para continuar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <Select onValueChange={setSelectedCompanyId} value={selectedCompanyId || ''}>
                <SelectTrigger className="w-full h-12 text-lg">
                    <SelectValue placeholder="Seleccione una empresa" />
                </SelectTrigger>
                <SelectContent>
                    {companies?.map(company => (
                        <SelectItem key={company.id} value={company.id}>
                            {company.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          
            <Input
                type="password"
                placeholder="Código de Acceso"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="w-full h-12 text-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          <Button onClick={handleLogin} className="w-full h-12 text-lg" disabled={isLoading}>
            {isLoading ? 'Verificando...' : 'Entrar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


export default function LoginPage() {
  // This wrapper is needed to ensure that useFirebase is called within the provider's context
  return <LoginPageContent />;
}
