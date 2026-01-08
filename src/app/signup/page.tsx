
"use client";

import { useState, useEffect, type FC } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider, signOut, type User, getRedirectResult, signInWithRedirect } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Mail, Lock, User as UserIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { type UserProfile } from '@/lib/types';


function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M22.56 12.25C22.56 11.45 22.48 10.65 22.34 9.87H12.28V14.45H18.16C17.88 15.89 17.06 17.14 15.82 17.94V20.47H19.51C21.45 18.61 22.56 15.69 22.56 12.25Z" fill="#4285F4"/>
      <path d="M12.28 23.0001C15.28 23.0001 17.76 22.0101 19.51 20.4701L15.82 17.9401C14.88 18.6101 13.68 19.0001 12.28 19.0001C9.68001 19.0001 7.43001 17.3901 6.55001 15.0801H2.74001V17.6101C4.54001 20.9401 8.13001 23.0001 12.28 23.0001Z" fill="#34A853"/>
      <path d="M6.55 15.08C6.35 14.48 6.23 13.85 6.23 13.2C6.23 12.55 6.35 11.92 6.55 11.32V8.79H2.74C1.88 10.43 1.33 12.25 1.33 14.2C1.33 16.15 1.88 17.97 2.74 19.61L6.55 15.08Z" fill="#FBBC05"/>
      <path d="M12.28 7.39995C13.76 7.39995 14.96 7.88995 15.87 8.75995L19.58 5.08995C17.75 3.33995 15.27 2.39995 12.28 2.39995C8.13 2.39995 4.54 4.45995 2.74 7.78995L6.55 10.3199C7.43 7.99995 9.68 7.39995 12.28 7.39995Z" fill="#EA4335"/>
    </svg>
  );
}

async function checkAndCreateUserProfile(firestore: any, user: any, allowedDomains: string[]): Promise<boolean> {
    if (!user.email) {
        throw new Error("No se pudo obtener el email de la cuenta de Google.");
    }
    
    const userDomain = user.email.split('@')[1];
    
    if (allowedDomains.length > 0 && !allowedDomains.includes(userDomain)) {
        throw new Error("El dominio de su correo no está autorizado para registrarse.");
    }

    const userDocRef = doc(firestore, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
        const newUserProfile: UserProfile = {
            uid: user.uid,
            name: user.displayName || 'Usuario',
            email: user.email,
            role: 'user', // Default role
        };
        await setDoc(userDocRef, newUserProfile);
    }
    return true;
}

export default function SignupPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: isUserLoading } = useUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectToDashboard = async (user: User) => {
    try {
        const tokenResult = await user.getIdTokenResult(true);
        const isAdmin = tokenResult.claims.role === 'admin';
        router.replace(isAdmin ? '/selection' : '/main');
    } catch (e) {
        console.error("Failed to get token result, redirecting to default", e);
        router.replace('/main');
    }
  };
  
   useEffect(() => {
    if (!isUserLoading && user) {
       redirectToDashboard(user);
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!auth || isUserLoading) return;
    
    setGoogleLoading(true);

    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          try {
            const configDocRef = doc(firestore, 'configuration', 'app');
            const configDoc = await getDoc(configDocRef);
            const allowedDomains = configDoc.exists() ? configDoc.data()?.allowedDomains || [] : ["vidana.com.mx", "blacktrust.net", "activ8.com.mx"];
            await checkAndCreateUserProfile(firestore, result.user, allowedDomains);
             toast({
                title: '¡Cuenta Creada!',
                description: 'Hemos creado tu cuenta exitosamente con Google.'
             });
          } catch(error: any) {
             setError(error.message || 'Error al verificar el perfil de usuario.');
             toast({ variant: 'destructive', title: 'Error de registro con Google', description: error.message });
             if (auth.currentUser) {
                await signOut(auth);
             }
          }
        }
      })
      .catch((error) => {
        console.error("Google Redirect Error: ", error);
        setError(error.message || 'Ocurrió un error al registrarse con Google.');
        toast({ variant: 'destructive', title: 'Error de registro con Google', description: error.message });
      })
      .finally(() => {
        setGoogleLoading(false);
      });
  }, [auth, firestore, isUserLoading, toast]);


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
        
        const allowedDomains = configDoc.exists() ? configDoc.data()?.allowedDomains || [] : ["vidana.com.mx", "blacktrust.net", "activ8.com.mx"];

        const userDomain = email.split('@')[1];

        if (allowedDomains.length > 0 && !allowedDomains.includes(userDomain)) {
            const errorMessage = "El dominio de su correo no está autorizado para registrarse.";
            setError(errorMessage);
            toast({
                variant: 'destructive',
                title: 'Registro no exitoso, usuario externo',
                description: errorMessage,
            });
            setIsLoading(false);
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName: name });
      
        const userProfile: UserProfile = {
            uid: user.uid,
            name: name,
            email: email,
            role: 'user', // Default role for new sign-ups
        };
        await setDoc(doc(firestore, 'users', user.uid), userProfile);

        toast({
          title: '¡Cuenta Creada!',
          description: 'Hemos creado tu cuenta exitosamente. Serás redirigido.'
        });
        
        // Let useEffect handle redirection
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

  const handleGoogleSignIn = async () => {
    if (!auth || !firestore) {
      setError('Servicio de autenticación no disponible.');
      return;
    }

    setGoogleLoading(true);
    setError(null);

    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  };
  
  if (isUserLoading || user) {
     return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
         <p className="ml-3 text-lg">Redirigiendo...</p>
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
                disabled={isLoading || isGoogleLoading}
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
                disabled={isLoading || isGoogleLoading}
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
                disabled={isLoading || isGoogleLoading}
            />
          </div>
          {error && <p className="text-sm text-red-500 px-1">{error}</p>}
          <Button onClick={handleSignup} className="w-full h-12 text-lg" disabled={isLoading || isGoogleLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Creando cuenta...</> : <><UserPlus className="mr-2 h-5 w-5"/> Registrarse</>}
          </Button>

          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">O continúa con</span>
          </div>

          <Button onClick={handleGoogleSignIn} variant="outline" className="w-full h-12 text-lg" disabled={isLoading || isGoogleLoading}>
            {isGoogleLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Verificando...</> : <><GoogleIcon className="mr-2 h-5 w-5"/> Google</>}
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
