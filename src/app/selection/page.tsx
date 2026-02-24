
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Loader2, LogOut, Settings, ClipboardList, AreaChart, Tablet, ChefHat, ShoppingCart, Package, BookOpen, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';

export default function SelectionPage() {
  const auth = useAuth();
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  const handleSignOut = async () => {
    if (auth) {
        await signOut(auth);
        localStorage.removeItem('selectedCompanyId');
        router.push('/login');
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-3 text-lg">Verificando acceso...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="absolute top-8 right-8">
        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
      <Card className="w-full max-w-6xl mx-4 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo />
          </div>
          <CardTitle className="text-3xl">Hola, {user?.displayName || 'Administrador'}</CardTitle>
          <CardDescription>Por favor, seleccione a dónde le gustaría ir.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
            <button
                onClick={() => router.push('/main')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <ClipboardList className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Registros</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Registrar accesos y gestionar empleados.</p>
            </button>
             <button
                onClick={() => router.push('/pos-inditex')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <ShoppingCart className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">POS Inditex</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Punto de venta para Inditex.</p>
            </button>
             <button
                onClick={() => router.push('/kiosk')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <Tablet className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Kiosk Televisa</h3>
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
            <button
                onClick={() => router.push('/inventario')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <Package className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Inventario</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Gestionar ingredientes y stock.</p>
            </button>
            <button
                onClick={() => router.push('/recetas')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <BookOpen className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Recetas</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Recetas y menú semanal.</p>
            </button>
            <button
                onClick={() => router.push('/costos')}
                className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300"
            >
                <TrendingDown className="h-7 w-7 mb-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Costos</h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-1">Dashboard financiero de cocinas.</p>
            </button>
        </CardContent>
      </Card>
    </div>
  );
}
