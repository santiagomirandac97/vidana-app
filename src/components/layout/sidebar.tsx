'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, signOut } from 'firebase/auth';
import { useFirebase, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type UserProfile } from '@/lib/types';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import { SidebarNav, type NavGroup } from './sidebar-nav';
import {
  ChevronLeft, ChevronRight, LogOut,
  ClipboardList, ShoppingCart, ChefHat,
  Package, BookOpen, Settings,
  BarChart2, TrendingDown, Receipt, TrendingUp,
  SmilePlus, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operaciones',
    items: [
      { href: '/main',        label: 'Registros',      icon: ClipboardList, minRole: 'operations' },
      { href: '/pos',         label: 'POS',             icon: ShoppingCart },
      { href: '/command',     label: 'Comanda',         icon: ChefHat },
    ],
  },
  {
    label: 'Gestión',
    minRole: 'operations',
    items: [
      { href: '/inventario',    label: 'Inventario',     icon: Package },
      { href: '/recetas',       label: 'Recetas',        icon: BookOpen },
      { href: '/configuracion', label: 'Configuración',  icon: Settings, minRole: 'admin' },
    ],
  },
  {
    label: 'Finanzas',
    minRole: 'admin',
    items: [
      { href: '/admin',       label: 'Admin',       icon: BarChart2 },
      { href: '/costos',      label: 'Costos',      icon: TrendingDown },
      { href: '/empleados',   label: 'Empleados',   icon: Users },
      { href: '/facturacion', label: 'Facturación', icon: Receipt },
      { href: '/reportes',    label: 'Reportes',    icon: TrendingUp },
    ],
  },
  {
    label: 'Satisfacción',
    minRole: 'admin',
    items: [
      { href: '/satisfaccion/encuestas', label: 'Encuestas', icon: SmilePlus },
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
  const userRole = userProfile?.role ?? 'user';

  const handleLogout = useCallback(async () => {
    if (!app) return;
    const auth = getAuth(app);
    await signOut(auth);
    if (typeof window !== 'undefined') {
      document.cookie = 'vidana_session=; path=/; max-age=0; SameSite=Strict; Secure';
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
          'flex items-center h-14 px-3 border-b border-sidebar-border/60 shrink-0',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 pl-1">
              <Logo />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60 shrink-0 transition-colors"
            onClick={onToggleCollapse}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </Button>
        </div>

        {/* Nav */}
        <SidebarNav groups={NAV_GROUPS} userRole={userRole} collapsed={collapsed} />

        {/* Footer */}
        <div className={cn(
          'shrink-0 border-t border-sidebar-border/60 p-3 space-y-1.5',
          collapsed ? 'flex flex-col items-center' : ''
        )}>
          <Link
            href="/perfil"
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-muted/60 transition-colors',
              collapsed ? 'justify-center px-0' : ''
            )}
          >
            <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border/40">
              <AvatarImage src={userProfile?.photoURL} alt={firstName} />
              <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                {firstName?.charAt(0)?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <span className="text-xs font-medium text-foreground truncate">{firstName}</span>
            )}
          </Link>
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            className={cn(
              'text-muted-foreground hover:text-foreground hover:bg-muted/60 gap-2 transition-colors',
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
