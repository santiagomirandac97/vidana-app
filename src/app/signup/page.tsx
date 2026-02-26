
"use client";

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Mail, Lock, User as UserIcon, CheckCircle2, XCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { type UserProfile, type UserInvite } from '@/lib/types';
import { checkAndCreateUserProfile } from '@/lib/auth-helpers';


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

// Inner component that uses useSearchParams — must be wrapped in Suspense
function SignupForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, isLoading: isUserLoading } = useUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite state
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<UserInvite | null>(null);
  const [inviteCompanyName, setInviteCompanyName] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<'loading' | 'valid' | 'invalid' | 'none'>('none');

  useEffect(() => {
    if (!isUserLoading && user) {
       router.replace('/selection');
    }
  }, [user, isUserLoading, router]);

  // Detect and validate invite on mount
  useEffect(() => {
    const inviteParam = searchParams.get('invite');
    if (!inviteParam || !firestore) return;

    setInviteId(inviteParam);
    setInviteStatus('loading');

    const validateInvite = async () => {
      try {
        const inviteDocRef = doc(firestore, 'invites', inviteParam);
        const inviteDoc = await getDoc(inviteDocRef);

        if (!inviteDoc.exists()) {
          setInviteStatus('invalid');
          return;
        }

        const data = { id: inviteDoc.id, ...inviteDoc.data() } as UserInvite;

        if (data.used || new Date(data.expiresAt) <= new Date()) {
          setInviteStatus('invalid');
          return;
        }

        setInviteData(data);
        setInviteStatus('valid');

        // Pre-fill email if provided in invite
        if (data.email) {
          setEmail(data.email);
        }

        // Fetch company name
        try {
          const companyDoc = await getDoc(doc(firestore, 'companies', data.companyId));
          if (companyDoc.exists()) {
            setInviteCompanyName((companyDoc.data() as { name: string }).name);
          } else {
            setInviteCompanyName(data.companyId);
          }
        } catch {
          setInviteCompanyName(data.companyId);
        }
      } catch {
        setInviteStatus('invalid');
      }
    };

    validateInvite();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Intentionally omit searchParams — invite param is read once on mount
  // when Firestore initializes. searchParams is stable for this page.
  }, [firestore]);

  const markInviteUsed = async (usedInviteId: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'invites', usedInviteId), { used: true });
    } catch {
      // Non-critical — don't fail the signup
    }
  };

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
        // If no invite, do domain check
        if (!inviteData) {
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
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        await updateProfile(newUser, { displayName: name });

        const userProfile: UserProfile = {
            uid: newUser.uid,
            name: name,
            email: email,
            role: inviteData ? inviteData.role : 'user',
            ...(inviteData?.companyId ? { companyId: inviteData.companyId } : {}),
        };
        await setDoc(doc(firestore, 'users', newUser.uid), userProfile);

        // Mark invite as used
        if (inviteData && inviteId) {
            await markInviteUsed(inviteId);
        }

        toast({
          title: '¡Cuenta Creada!',
          description: 'Hemos creado tu cuenta exitosamente. Serás redirigido.'
        });

        // Let useEffect handle redirection
    } catch (err: unknown) {
      let friendlyMessage = 'Ocurrió un error al registrar la cuenta.';
      if (err instanceof Error && 'code' in err) {
        const firebaseErr = err as { code: string; message: string };
        if (firebaseErr.code === 'auth/email-already-in-use') {
          friendlyMessage = 'Este email ya se encuentra registrado.';
        } else if (firebaseErr.code === 'auth/invalid-email') {
          friendlyMessage = 'El formato del email no es válido.';
        } else if (firebaseErr.code === 'auth/weak-password') {
          friendlyMessage = 'La contraseña es demasiado débil.';
        } else {
          console.error(err);
          friendlyMessage = err.message;
        }
      }
       setError(friendlyMessage);
       toast({
        variant: 'destructive',
        title: 'Error de registro',
        description: friendlyMessage,
      });
    } finally {
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

    try {
        const result = await signInWithPopup(auth, provider);
        await checkAndCreateUserProfile(firestore, result.user, inviteData);

        // Mark invite as used
        if (inviteData && inviteId) {
            await markInviteUsed(inviteId);
        }

        toast({ title: '¡Cuenta Creada!', description: 'Hemos creado tu cuenta exitosamente con Google.' });
    } catch (error: unknown) {
        const firebaseErr = error as { code?: string; message?: string };
        if (firebaseErr.code === 'auth/popup-blocked' || firebaseErr.code === 'auth/cancelled-popup-request' || firebaseErr.code === 'auth/popup-closed-by-user') {
            try {
                await signInWithRedirect(auth, provider);
            } catch(redirectError: unknown) {
                const rdErr = redirectError as { message?: string };
                const friendlyMessage = rdErr.message?.includes("El dominio de su correo no está autorizado")
                    ? rdErr.message
                    : 'No se pudo completar el registro con Google.';
                setError(friendlyMessage ?? 'Error desconocido');
                toast({ variant: 'destructive', title: 'Error de Google', description: friendlyMessage });
                setGoogleLoading(false);
            }
        } else {
            let friendlyMessage = 'Ocurrió un error al registrarse con Google.';
            if (firebaseErr.message?.includes("El dominio de su correo no está autorizado")) {
                friendlyMessage = firebaseErr.message;
            }
            setError(friendlyMessage);
            toast({ variant: 'destructive', title: 'Error de registro con Google', description: friendlyMessage });

            if (auth.currentUser) await signOut(auth);
            setGoogleLoading(false);
        }
    }
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
    <div className="flex min-h-screen">
      {/* Left panel — brand (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 text-white text-center">
          <Logo />
          <p className="text-lg font-medium opacity-90 mt-8">Gestión de comedores empresariales</p>
          <p className="text-sm opacity-60 mt-2">Vidana · México</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          {/* Logo visible on mobile only */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-1">Crear cuenta</h2>
          <p className="text-sm text-muted-foreground mb-6">Completa el formulario para registrarte</p>

          {/* Invite banner */}
          {inviteStatus === 'loading' && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>Verificando invitación...</span>
            </div>
          )}
          {inviteStatus === 'valid' && inviteCompanyName && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Invitación válida para <strong>{inviteCompanyName}</strong></span>
            </div>
          )}
          {inviteStatus === 'invalid' && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>Esta invitación no es válida o ya fue usada. Puedes crear una cuenta, pero necesitarás que un administrador te asigne a una empresa.</span>
            </div>
          )}

          <div className="space-y-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
