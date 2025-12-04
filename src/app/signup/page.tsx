
"use client";

import { useState, useEffect, type FC } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Mail, Lock, User as UserIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

function SignupPageContent() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSignup = async () => {
    if (!name || !email || !password) {
      setError('Por favor, complete todos los campos.');
      return;
    }
    if (!auth || !firestore) {
        setError('Servicio de autenticación no disponible.');
        return;
    }
    if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
        const configDocRef = doc(firestore, 'configuration', 'app');
        const configDoc = await getDoc(configDocRef);

        if (!configDoc.exists()) {
            throw new Error("No se pudo cargar la configuración de la aplicación.");
        }

        const allowedDomains: string[] = configDoc.data()?.allowedDomains || [];
        const userDomain = email.split('@')[1];

        if (allowedDomains.length > 0 && !allowedDomains.includes(userDomain)) {
            const errorMessage = 'Registro no exitoso, usuario externo';
            setError(errorMessage);
            toast({
                variant: 'destructive',
                title: 'Registro no exitoso',
                description: "El dominio de su correo no está autorizado para registrarse.",
            });
            setIsLoading(false);
            return;
        }


        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName: name });
      
        // Create user profile in Firestore
        const userDocRef = doc(firestore, 'users', user.uid);
        await setDoc(userDocRef, {
            uid: user.uid,
            name: name,
            email: email,
        });

        toast({
          title: '¡Cuenta Creada!',
          description: 'Hemos creado tu cuenta exitosamente. Serás redirigido.'
        });

        // Force reload user object
        await user.reload();
      
        router.push('/');
    } catch (err: any) {
      let friendlyMessage = 'Ocurrió un error al registrar la cuenta.';
      if (err.code === 'auth/email-already-in-use') {
        friendlyMessage = 'Este email ya se encuentra registrado.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyMessage = 'El formato del email no es válido.';
      } else if (err.code === 'auth/weak-password') {
        friendlyMessage = 'La contraseña es demasiado débil.';
      } else {
        console.error(err);
        friendlyMessage = err.message;
      }
       setError(friendlyMessage);
       toast({
        variant: 'destructive',
        title: 'Error de registro',
        description: friendlyMessage,
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
          <CardTitle className="text-2xl">Crear Cuenta</CardTitle>
          <CardDescription>Cree una nueva cuenta para acceder al sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="relative">
             <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
             <Input
                type="text"
                placeholder="Nombre Completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10 h-12 text-lg"
                disabled={isLoading}
            />
          </div>
          <div className="relative">
             <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
             <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 text-lg"
                disabled={isLoading}
            />
          </div>
          
          <div className="relative">
             <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12 text-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
                disabled={isLoading}
            />
          </div>
          {error && <p className="text-sm text-red-500 px-1">{error}</p>}
          <Button onClick={handleSignup} className="w-full h-12 text-lg" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Creando cuenta...</> : <><UserPlus className="mr-2 h-5 w-5"/> Registrarse</>}
          </Button>
          <Separator className="my-4" />
           <div className="text-center text-sm">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Inicia Sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


export default function SignupPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading || user) {
     return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <SignupPageContent />;
}
