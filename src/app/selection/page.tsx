'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import {
  Loader2, LogOut, Settings, ClipboardList, AreaChart, Tablet,
  ChefHat, ShoppingCart, Package, BookOpen, TrendingDown, Receipt,
} from 'lucide-react';
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
      <div className="flex h-screen items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando acceso…</p>
      </div>
    );
  }

  const firstName = user?.displayName?.split(' ')[0] ?? 'Administrador';

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal top bar */}
      <header className="page-header">
        <div className="page-header-inner">
          <div className="page-header-brand">
            <Logo />
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground gap-1.5">
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-5xl">
        {/* Greeting */}
        <div className="mb-10">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-1">Panel de control</p>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Bienvenido, <span className="text-primary">{firstName}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">¿A dónde te gustaría ir?</p>
        </div>

        {/* ── Operaciones ─────────────────────────────────────────── */}
        <section className="mb-8">
          <p className="section-label">Operaciones</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button onClick={() => router.push('/main')} className="nav-tile">
              <span className="nav-tile-icon"><ClipboardList className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-foreground">Registros</span>
              <span className="text-xs text-muted-foreground mt-0.5 text-center">Accesos y empleados</span>
            </button>
            <button onClick={() => router.push('/pos-inditex')} className="nav-tile">
              <span className="nav-tile-icon"><ShoppingCart className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-foreground">POS Inditex</span>
              <span className="text-xs text-muted-foreground mt-0.5 text-center">Punto de venta</span>
            </button>
            <button onClick={() => router.push('/kiosk')} className="nav-tile">
              <span className="nav-tile-icon"><Tablet className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-foreground">Kiosk Televisa</span>
              <span className="text-xs text-muted-foreground mt-0.5 text-center">PV Noticieros</span>
            </button>
            <button onClick={() => router.push('/command')} className="nav-tile">
              <span className="nav-tile-icon"><ChefHat className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-foreground">Comanda</span>
              <span className="text-xs text-muted-foreground mt-0.5 text-center">Centro de cocina</span>
            </button>
          </div>
        </section>

        {/* ── Gestión ──────────────────────────────────────────────── */}
        <section className="mb-8">
          <p className="section-label">Gestión</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button onClick={() => router.push('/inventario')} className="nav-tile">
              <span className="nav-tile-icon"><Package className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-foreground">Inventario</span>
              <span className="text-xs text-muted-foreground mt-0.5 text-center">Ingredientes y stock</span>
            </button>
            <button onClick={() => router.push('/recetas')} className="nav-tile">
              <span className="nav-tile-icon"><BookOpen className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-foreground">Recetas</span>
              <span className="text-xs text-muted-foreground mt-0.5 text-center">Recetas y menú IA</span>
            </button>
            <button onClick={() => router.push('/configuracion')} className="nav-tile">
              <span className="nav-tile-icon"><Settings className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-foreground">Configuración</span>
              <span className="text-xs text-muted-foreground mt-0.5 text-center">Empresas y ajustes</span>
            </button>
          </div>
        </section>

        {/* ── Finanzas ─────────────────────────────────────────────── */}
        <section>
          <p className="section-label">Finanzas</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button onClick={() => router.push('/admin')} className="nav-tile">
              <span className="nav-tile-icon"><AreaChart className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-foreground">Admin</span>
              <span className="text-xs text-muted-foreground mt-0.5 text-center">Estadísticas generales</span>
            </button>
            <button onClick={() => router.push('/costos')} className="nav-tile">
              <span className="nav-tile-icon"><TrendingDown className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-foreground">Costos</span>
              <span className="text-xs text-muted-foreground mt-0.5 text-center">Dashboard financiero</span>
            </button>
            <button onClick={() => router.push('/facturacion')} className="nav-tile">
              <span className="nav-tile-icon"><Receipt className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-foreground">Facturación</span>
              <span className="text-xs text-muted-foreground mt-0.5 text-center">Estados de cuenta</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
