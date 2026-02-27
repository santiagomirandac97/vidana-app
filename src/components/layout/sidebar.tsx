'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, signOut } from 'firebase/auth';
import { useFirebase, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type UserProfile } from '@/lib/types';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { SidebarNav, type NavGroup } from './sidebar-nav';
import {
  ChevronLeft, ChevronRight, LogOut,
  ClipboardList, Monitor, ShoppingCart, ChefHat,
  Package, BookOpen, Settings,
  BarChart2, TrendingDown, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operaciones',
    items: [
      { href: '/main',        label: 'Registros',      icon: ClipboardList },
      { href: '/kiosk',       label: 'Kiosk Televisa', icon: Monitor },
      { href: '/pos-inditex', label: 'POS Inditex',    icon: ShoppingCart },
      { href: '/command',     label: 'Comanda',         icon: ChefHat },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/inventario',    label: 'Inventario',     icon: Package },
      { href: '/recetas',       label: 'Recetas',        icon: BookOpen },
      { href: '/configuracion', label: 'Configuración',  icon: Settings, adminOnly: true },
    ],
  },
  {
    label: 'Finanzas',
    adminOnly: true,
    items: [
      { href: '/admin',       label: 'Admin',       icon: BarChart2 },
      { href: '/costos',      label: 'Costos',      icon: TrendingDown },
      { href: '/facturacion', label: 'Facturación', icon: Receipt },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const { user } = useUser();
  const { firestore, app } = useFirebase();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(
    () => firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const isAdmin = userProfile?.role === 'admin';

  const handleLogout = useCallback(async () => {
    if (!app) return;
    const auth = getAuth(app);
    await signOut(auth);
    if (typeof window !== 'undefined') {
      document.cookie = 'vidana_session=; path=/; max-age=0; SameSite=Strict';
    }
    router.push('/login');
  }, [app, router]);

  const firstName = userProfile?.name?.split(' ')[0] ?? user?.displayName?.split(' ')[0] ?? '';

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-200',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center h-14 px-3 border-b border-sidebar-border shrink-0',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <Logo />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
            onClick={onToggleCollapse}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </Button>
        </div>

        {/* Nav */}
        <SidebarNav groups={NAV_GROUPS} isAdmin={isAdmin} collapsed={collapsed} />

        {/* Footer */}
        <div className={cn(
          'shrink-0 border-t border-sidebar-border p-3',
          collapsed ? 'flex justify-center' : ''
        )}>
          {!collapsed && (
            <p className="text-xs font-medium text-foreground truncate mb-2 px-1">{firstName}</p>
          )}
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            className={cn(
              'text-muted-foreground hover:text-foreground gap-2',
              collapsed ? 'h-8 w-8' : 'w-full justify-start h-8 text-xs'
            )}
            onClick={handleLogout}
          >
            <LogOut size={14} />
            {!collapsed && 'Cerrar sesión'}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
