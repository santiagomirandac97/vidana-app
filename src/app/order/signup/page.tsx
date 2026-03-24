
"use client";

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Mail, Lock, User as UserIcon, CheckCircle2, XCircle } from 'lucide-react';
import { type UserProfile, type UserInvite } from '@/lib/types';


function CustomerSignupForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, isLoading: isUserLoading } = useUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite state
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<UserInvite | null>(null);
  const [inviteCompanyName, setInviteCompanyName] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<'loading' | 'valid' | 'invalid' | 'none'>('none');

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/order');
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
  }, [firestore]);

  const markInviteUsed = async (usedInviteId: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'invites', usedInviteId), { used: true });
    } catch {
      // Non-critical
    }
  };

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError('Por favor, complete todos los campos.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!auth || !firestore) {
      setError('Servicio de autenticación no disponible.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let companyId: string | undefined;

      if (inviteData) {
        // Use invite's companyId
        companyId = inviteData.companyId;
      } else {
        // Domain-based company matching
        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain) {
          setError('El formato del email no es válido.');
          setIsLoading(false);
          return;
        }

        const companiesQuery = query(
          collection(firestore, 'companies'),
          where('allowedCustomerDomains', 'array-contains', domain)
        );
        const companiesSnapshot = await getDocs(companiesQuery);

        if (companiesSnapshot.empty) {
          setError('Tu dominio no está autorizado. Contacta a tu administrador.');
          toast({
            variant: 'destructive',
            title: 'Dominio no autorizado',
            description: 'Tu dominio no está autorizado. Contacta a tu administrador.',
          });
          setIsLoading(false);
          return;
        }

        companyId = companiesSnapshot.docs[0].id;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      await updateProfile(newUser, { displayName: name });

      const userProfile: UserProfile = {
        uid: newUser.uid,
        name: name,
        email: email,
        role: 'customer',
        companyId: companyId,
      };
      await setDoc(doc(firestore, 'users', newUser.uid), userProfile);

      // Mark invite as used
      if (inviteData && inviteId) {
        await markInviteUsed(inviteId);
      }

      if (typeof window !== 'undefined') {
        document.cookie = 'vidana_session=1; path=/; max-age=86400; SameSite=Strict; Secure';
      }

      toast({
        title: '¡Cuenta Creada!',
        description: 'Hemos creado tu cuenta exitosamente. Serás redirigido.',
      });

      router.replace('/order');
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

  if (isUserLoading || user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-3 text-lg">Redirigiendo...</p>
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
        {/* Logo — links back to landing page */}
        <div className="mb-8 flex justify-center">
          <a href="/" className="transition-opacity hover:opacity-80">
            <Logo />
          </a>
        </div>

        <h2 className="text-center text-2xl font-semibold tracking-tight text-gray-900 mb-1">Crea tu cuenta</h2>
        <p className="text-center text-sm text-gray-500 mb-6">Para ordenar en tu comedor corporativo</p>

        {/* Invite banner */}
        {inviteStatus === 'loading' && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>Verificando invitación...</span>
          </div>
        )}
        {inviteStatus === 'valid' && inviteCompanyName && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Invitación válida para <strong>{inviteCompanyName}</strong></span>
          </div>
        )}
        {inviteStatus === 'invalid' && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Esta invitación no es válida o ya fue usada. Puedes registrarte con tu email corporativo.</span>
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
              className="pl-10 h-12 text-base bg-gray-50 border-gray-200 focus:bg-white rounded-xl"
              disabled={isLoading}
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="email"
              placeholder="Email corporativo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 text-base bg-gray-50 border-gray-200 focus:bg-white rounded-xl"
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
              className="pl-10 h-12 text-base bg-gray-50 border-gray-200 focus:bg-white rounded-xl"
              disabled={isLoading}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="password"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12 text-base bg-gray-50 border-gray-200 focus:bg-white rounded-xl"
              onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
              disabled={isLoading}
            />
          </div>

          {error && <p className="text-sm text-red-500 px-1">{error}</p>}

          <Button onClick={handleSignup} className="w-full h-12 text-base rounded-xl" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Creando cuenta...</> : <><UserPlus className="mr-2 h-5 w-5"/> Registrarse</>}
          </Button>

          <div className="pt-2 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Inicia sesión
            </Link>
          </div>
        </div>
      </div>

      {/* Footer tagline */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-sm text-white/50">&copy; 2022–2026 Vidana. Todos los derechos reservados.</p>
      </div>
    </div>
  );
}

export default function CustomerSignupPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <CustomerSignupForm />
    </Suspense>
  );
}
