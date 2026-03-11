
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore, useFirebase } from '@/firebase';
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, Mail, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
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

function PasswordResetDialog() {
    const { app } = useFirebase();
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const handlePasswordReset = async () => {
        if (!email) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, ingrese su email.' });
            return;
        }
        if (!app) {
            toast({ variant: 'destructive', title: 'Error', description: 'Servicio no disponible.' });
            return;
        }

        setIsSending(true);

        try {
            const functions = getFunctions(app);
            const sendReset = httpsCallable(functions, 'sendPasswordReset');
            await sendReset({ email: email.trim().toLowerCase() });
            toast({ title: 'Correo Enviado', description: 'Revise su bandeja de entrada para restablecer su contraseña.' });
            setIsOpen(false);
            setEmail('');
        } catch (error: unknown) {
            let friendlyMessage = 'Ocurrió un error al enviar el correo.';
            const fbError = error as { code?: string; message?: string };
            if (fbError.message?.includes('resource-exhausted')) {
                friendlyMessage = 'Ya se envió un correo recientemente. Espera un minuto.';
            }
            toast({ variant: 'destructive', title: 'Error', description: friendlyMessage });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="link" size="sm" className="w-full px-0 font-normal">
                    ¿Olvidaste tu contraseña?
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Restablecer Contraseña</DialogTitle>
                    <DialogDescription>
                        Ingrese su email y le enviaremos un enlace para restablecer su contraseña.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            id="reset-email"
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 h-12 text-lg"
                            disabled={isSending}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" disabled={isSending}>
                            Cancelar
                        </Button>
                    </DialogClose>
                    <Button onClick={handlePasswordReset} disabled={isSending}>
                        {isSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : 'Enviar Correo'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: isUserLoading } = useUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoading && user) {
        router.replace('/selection');
        return;
    }
    // Handle redirect result (popup-blocked fallback)
    if (!isUserLoading && !user && auth) {
      getRedirectResult(auth)
        .then(async (result) => {
          if (result?.user) {
            // User came back from redirect — create profile if needed
            if (firestore) {
              await checkAndCreateUserProfile(firestore, result.user);
            }
            router.replace('/selection');
          }
        })
        .catch(() => {
          // Silently ignore — no redirect pending
        });
    }
  }, [user, isUserLoading, router, auth, firestore]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor, ingrese su email y contraseña.');
      return;
    }
    if (!auth || !firestore) {
        setError('Servicio de autenticación no disponible.');
        return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Let the useEffect handle redirection
      await checkAndCreateUserProfile(firestore, userCredential.user);
    } catch (err: any) {
      let friendlyMessage = 'Ocurrió un error al iniciar sesión.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        friendlyMessage = 'El email o la contraseña son incorrectos.';
      }
      setError(friendlyMessage);
      toast({
        variant: 'destructive',
        title: 'Error de acceso',
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
        await checkAndCreateUserProfile(firestore, result.user);
    } catch (error: any) {
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
            try {
                // Fallback to redirect method for Safari
                await signInWithRedirect(auth, provider);
            } catch (redirectError: any) {
                 const friendlyMessage = redirectError.message.includes("El dominio de su correo no está autorizado") 
                    ? redirectError.message 
                    : 'No se pudo completar el inicio de sesión con Google.';
                setError(friendlyMessage);
                toast({ variant: 'destructive', title: 'Error de Google', description: friendlyMessage });
                setGoogleLoading(false);
            }
        } else {
             let friendlyMessage = 'Ocurrió un error al iniciar sesión con Google.';
            if (error.message.includes("El dominio de su correo no está autorizado")) {
                friendlyMessage = error.message;
            }
            setError(friendlyMessage);
            toast({ variant: 'destructive', title: 'Error de acceso con Google', description: friendlyMessage });

            if (auth.currentUser) await signOut(auth);
            setGoogleLoading(false);
        }
    }
  };

  if (isUserLoading || user) {
     return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-3 text-lg">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Full-bleed gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, hsl(224, 76%, 48%) 0%, hsl(230, 72%, 32%) 50%, hsl(235, 80%, 18%) 100%)',
        }}
      />
      {/* Radial glow accent — top right */}
      <div
        className="absolute -top-32 -right-32 h-[600px] w-[600px] rounded-full opacity-30"
        style={{
          background: 'radial-gradient(circle, hsl(210, 100%, 70%) 0%, transparent 70%)',
        }}
      />
      {/* Secondary glow — bottom left */}
      <div
        className="absolute -bottom-48 -left-48 h-[500px] w-[500px] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, hsl(250, 80%, 65%) 0%, transparent 70%)',
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] sm:p-10">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <h2 className="text-center text-2xl font-semibold tracking-tight text-gray-900 mb-1">Iniciar sesión</h2>
        <p className="text-center text-sm text-gray-500 mb-8">Ingresa tus credenciales para continuar</p>

        <div className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 text-base bg-gray-50 border-gray-200 focus:bg-white"
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
              className="pl-10 h-12 text-base bg-gray-50 border-gray-200 focus:bg-white"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              disabled={isLoading || isGoogleLoading}
            />
          </div>

          <div className="flex justify-end">
            <PasswordResetDialog />
          </div>

          {error && <p className="text-sm text-red-500 px-1">{error}</p>}

          <Button onClick={handleLogin} className="w-full h-12 text-base" disabled={isLoading || isGoogleLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Verificando...</> : <><LogIn className="mr-2 h-5 w-5"/> Entrar</>}
          </Button>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <span className="relative bg-white px-3 text-xs uppercase text-gray-400">O continúa con</span>
          </div>

          <Button onClick={handleGoogleSignIn} variant="outline" className="w-full h-12 text-base border-gray-200 hover:bg-gray-50" disabled={isLoading || isGoogleLoading}>
            {isGoogleLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Verificando...</> : <><GoogleIcon className="mr-2 h-5 w-5"/> Google</>}
          </Button>

          <div className="pt-2 text-center text-sm text-gray-500">
            ¿No tienes cuenta?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Regístrate
            </Link>
          </div>
        </div>
      </div>

      {/* Footer tagline */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-sm text-white/50">© 2022–2026 Vidana. Todos los derechos reservados.</p>
      </div>
    </div>
  );
}
