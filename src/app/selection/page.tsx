
'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useFirebase, useMemoFirebase, useAuth } from '@/firebase';
import { doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Loader2, LogOut, Settings, ClipboardList, AreaChart, Tablet, ChefHat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { type UserProfile } from '@/lib/types';


export default function SelectionPage() {
  const { user, isLoading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const auth = useAuth();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => 
    firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace('/login');
    }
    // If user is not admin, redirect to main app
    if (!profileLoading && userProfile && userProfile.role !== 'admin') {
      router.replace('/main');
    }
  }, [user, userLoading, profileLoading, userProfile, router]);


  const handleSignOut = async () => {
    if (auth) {
        await signOut(auth);
        localStorage.removeItem('selectedCompanyId');
        router.push('/login');
    }
  };

  if (userLoading || profileLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-3 text-lg">Cargando perfil...</p>
      </div>
    );
  }

  // This should ideally not be reached for non-admins due to the useEffect redirect,
  // but it's a good fallback.
  if (!userProfile || userProfile.role !== 'admin') {
      return (
         <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-3 text-lg">Redirigiendo...</p>
         </div>
      )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="absolute top-8 right-8">
        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
      <Card className="w-full max-w-5xl mx-4 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo />
          </div>
          <CardTitle className="text-3xl">Bienvenido, {userProfile.name}</CardTitle>
          <CardDescription>Por favor, seleccione a dónde le gustaría ir.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-6 p-6">
            <button
                onClick={() => router.push('/main')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <ClipboardList className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Registros</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Registrar accesos y gestionar empleados.</p>
            </button>
             <button
                onClick={() => router.push('/kiosk')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <Tablet className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Kiosk</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Punto de venta para Noticieros.</p>
            </button>
            <button
                onClick={() => router.push('/command')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <ChefHat className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Comanda</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Centro de comando de cocina.</p>
            </button>
            <button
                onClick={() => router.push('/admin')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <AreaChart className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Admin</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Ver estadísticas y reportes generales.</p>
            </button>
             <button
                onClick={() => router.push('/configuracion')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <Settings className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />

                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Configuración</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Gestionar empresas y la aplicación.</p>
            </button>
        </CardContent>
      </Card>
    </div>
  );
}
