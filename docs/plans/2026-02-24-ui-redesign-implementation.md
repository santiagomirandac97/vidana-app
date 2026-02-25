# Vidana UI/UX Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Elevate the Vidana app from a functional prototype to a professional enterprise tool with Geist typography, a refined color system, a persistent collapsible sidebar, and consistent shared components across all 13 routes.

**Architecture:** The redesign layers on top of the existing shadcn/Tailwind stack — no components are removed, only upgraded. A new `src/components/layout/` directory houses `AppShell`, `Sidebar`, and `PageHeader`. Every authenticated page wraps its content in `<AppShell>`. Auth pages stay standalone. Zero changes to any Firebase/data logic.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Geist font (`geist` npm package), Lucide icons, Firebase Auth/Firestore (unchanged)

**Design doc:** `docs/plans/2026-02-24-full-ui-redesign.md`

---

## Task 1: Install Geist Font

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/app/layout.tsx`

**Step 1: Install the geist package**
```bash
cd "Vidana App"
npm install geist
```
Expected: `geist` appears in `package.json` dependencies.

**Step 2: Update `src/app/layout.tsx`**

Replace the current Inter import with Geist:
```typescript
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { FirebaseClientProvider } from '@/firebase';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vidana',
  description: 'Gestión de comedores empresariales',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
```

**Step 3: Verify font variables load**
Run `npm run dev`, open browser, open DevTools → Elements → `<html>`. Should see two CSS variables like `--font-geist-sans` and `--font-geist-mono` on the html element.

**Step 4: Commit**
```bash
git add src/app/layout.tsx package.json package-lock.json
git commit -m "feat: replace Inter with Geist Sans + Geist Mono fonts"
```

---

## Task 2: Update Design System — CSS Variables + Tailwind

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

**Step 1: Update `:root` in `src/app/globals.css`**

Replace the entire `:root` block and `.dark` block with:
```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;
    --primary: 224 76% 48%;
    --primary-foreground: 0 0% 100%;
    --secondary: 220 14% 96%;
    --secondary-foreground: 222 47% 11%;
    --muted: 220 14% 96%;
    --muted-foreground: 220 9% 46%;
    --accent: 220 14% 96%;
    --accent-foreground: 222 47% 11%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 224 76% 48%;
    --radius: 0.5rem;
    --sidebar: 210 20% 98%;
    --sidebar-foreground: 222 47% 11%;
    --sidebar-border: 220 13% 91%;
    /* Semantic */
    --success: 142 76% 36%;
    --warning: 38 92% 50%;
  }

  .dark {
    --background: 222 47% 11%;
    --foreground: 210 40% 98%;
    --card: 222 47% 11%;
    --card-foreground: 210 40% 98%;
    --popover: 222 47% 11%;
    --popover-foreground: 210 40% 98%;
    --primary: 224 76% 60%;
    --primary-foreground: 0 0% 100%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;
    --accent: 217 33% 17%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 63% 55%;
    --destructive-foreground: 0 0% 100%;
    --border: 217 33% 17%;
    --input: 217 33% 17%;
    --ring: 224 76% 60%;
    --sidebar: 222 47% 9%;
    --sidebar-foreground: 210 40% 98%;
    --sidebar-border: 217 33% 17%;
    --success: 142 70% 45%;
    --warning: 38 92% 55%;
  }
}
```

**Step 2: Update `tailwind.config.ts`** — add font variables, sidebar color, and semantic colors:
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          border: 'hsl(var(--sidebar-border))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: '0 1px 3px rgb(0 0 0 / 0.08)',
        'card-hover': '0 4px 12px rgb(0 0 0 / 0.10)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

**Step 3: Update body styles in `globals.css`** — replace the body font declaration:
```css
body {
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**Step 4: Run dev server and verify**
```bash
npm run dev
```
Open browser. The app should still work. Typography will have changed to Geist. Colors will be slightly different (deeper blue primary, refined grays).

**Step 5: Commit**
```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "feat: update design system — Geist fonts, refined color palette, 8px radius"
```

---

## Task 3: Build the Sidebar Component

**Files:**
- Create: `src/components/layout/sidebar-nav.tsx`
- Create: `src/components/layout/sidebar.tsx`

**Step 1: Create `src/components/layout/sidebar-nav.tsx`**

This handles nav item rendering and active state detection:
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavGroup {
  label: string;
  adminOnly?: boolean;
  items: NavItem[];
}

interface SidebarNavProps {
  groups: NavGroup[];
  isAdmin: boolean;
  collapsed: boolean;
}

export function SidebarNav({ groups, isAdmin, collapsed }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto py-4 px-2">
      {groups.map((group) => {
        if (group.adminOnly && !isAdmin) return null;
        const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin);
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.label} className="mb-6">
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
            )}
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              const linkContent = (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                    isActive
                      ? 'border-l-2 border-primary bg-primary/5 text-primary font-medium pl-[10px]'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent pl-[10px]',
                    collapsed && 'justify-center px-2 pl-2'
                  )}
                >
                  <Icon className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} size={16} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.href}>{linkContent}</div>;
            })}
          </div>
        );
      })}
    </nav>
  );
}
```

**Step 2: Create `src/components/layout/sidebar.tsx`**

```typescript
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
```

**Step 3: Commit**
```bash
git add src/components/layout/
git commit -m "feat: add Sidebar and SidebarNav components"
```

---

## Task 4: Build the AppShell Component

**Files:**
- Create: `src/components/layout/app-shell.tsx`
- Create: `src/components/layout/mobile-top-bar.tsx`

**Step 1: Create `src/components/layout/mobile-top-bar.tsx`**

```typescript
'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';

interface MobileTopBarProps {
  onMenuClick: () => void;
}

export function MobileTopBar({ onMenuClick }: MobileTopBarProps) {
  return (
    <div className="flex items-center gap-3 h-12 px-4 bg-background border-b border-border">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMenuClick}>
        <Menu size={18} />
      </Button>
      <Logo />
    </div>
  );
}
```

**Step 2: Create `src/components/layout/app-shell.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Sidebar } from './sidebar';
import { MobileTopBar } from './mobile-top-bar';

const STORAGE_KEY = 'vidana_sidebar_collapsed';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  // Avoid hydration mismatch — render without sidebar state until mounted
  if (!mounted) {
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </div>

      {/* Mobile: top bar + sheet sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background">
        <MobileTopBar onMenuClick={() => setMobileOpen(true)} />
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-60">
          <Sidebar collapsed={false} onToggleCollapse={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="md:hidden h-12" /> {/* spacer for mobile top bar */}
        {children}
      </main>
    </div>
  );
}
```

**Step 3: Create a barrel export `src/components/layout/index.ts`**

```typescript
export { AppShell } from './app-shell';
export { PageHeader } from './page-header';  // built in next task
export { Sidebar } from './sidebar';
export { SidebarNav } from './sidebar-nav';
```

**Step 4: Commit**
```bash
git add src/components/layout/
git commit -m "feat: add AppShell component with collapsible sidebar and mobile sheet"
```

---

## Task 5: Build PageHeader Component

**Files:**
- Create: `src/components/layout/page-header.tsx`

**Step 1: Create `src/components/layout/page-header.tsx`**

```typescript
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 pb-6 border-b border-border mb-6', className)}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
```

**Step 2: Update barrel export in `src/components/layout/index.ts`**

Make sure `PageHeader` is exported (add if not already there):
```typescript
export { AppShell } from './app-shell';
export { PageHeader } from './page-header';
export { Sidebar } from './sidebar';
export { SidebarNav } from './sidebar-nav';
```

**Step 3: Commit**
```bash
git add src/components/layout/
git commit -m "feat: add PageHeader layout component"
```

---

## Task 6: Build Shared UI Components (KpiCard, StatusBadge, SectionLabel)

**Files:**
- Create: `src/components/ui/kpi-card.tsx`
- Create: `src/components/ui/status-badge.tsx`
- Create: `src/components/ui/section-label.tsx`

**Step 1: Create `src/components/ui/kpi-card.tsx`**

```typescript
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  loading?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const VARIANT_CLASSES = {
  default:     'border-l-2 border-primary',
  success:     'border-l-2 border-success',
  warning:     'border-l-2 border-warning',
  destructive: 'border-l-2 border-destructive',
};

export function KpiCard({ label, value, icon, loading, variant = 'default', className }: KpiCardProps) {
  return (
    <div className={cn(
      'bg-card rounded-lg p-4 shadow-card',
      VARIANT_CLASSES[variant],
      className
    )}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
      ) : (
        <p className="text-2xl font-bold font-mono tracking-tight text-foreground">{value}</p>
      )}
    </div>
  );
}
```

**Step 2: Create `src/components/ui/status-badge.tsx`**

```typescript
import { cn } from '@/lib/utils';

type StatusVariant = 'pendiente' | 'enviado' | 'pagado' | 'borrador' | 'recibido' | 'success' | 'warning' | 'error';

const VARIANT_STYLES: Record<StatusVariant, string> = {
  pendiente: 'bg-amber-50  text-amber-700  border-amber-200',
  enviado:   'bg-blue-50   text-blue-700   border-blue-200',
  pagado:    'bg-green-50  text-green-700  border-green-200',
  borrador:  'bg-gray-50   text-gray-600   border-gray-200',
  recibido:  'bg-green-50  text-green-700  border-green-200',
  success:   'bg-green-50  text-green-700  border-green-200',
  warning:   'bg-amber-50  text-amber-700  border-amber-200',
  error:     'bg-red-50    text-red-700    border-red-200',
};

const VARIANT_LABELS: Partial<Record<StatusVariant, string>> = {
  pendiente: 'Pendiente',
  enviado:   'Enviado',
  pagado:    'Pagado',
  borrador:  'Borrador',
  recibido:  'Recibido',
};

interface StatusBadgeProps {
  variant: StatusVariant;
  label?: string;
  className?: string;
}

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  const displayLabel = label ?? VARIANT_LABELS[variant] ?? variant;
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
      VARIANT_STYLES[variant],
      className
    )}>
      {displayLabel}
    </span>
  );
}
```

**Step 3: Create `src/components/ui/section-label.tsx`**

```typescript
import { cn } from '@/lib/utils';

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <p className={cn(
      'text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3',
      className
    )}>
      {children}
    </p>
  );
}
```

**Step 4: Commit**
```bash
git add src/components/ui/kpi-card.tsx src/components/ui/status-badge.tsx src/components/ui/section-label.tsx
git commit -m "feat: add KpiCard, StatusBadge, and SectionLabel shared components"
```

---

## Task 7: Migrate `/admin` Page

**Files:**
- Modify: `src/app/admin/page.tsx`

**Step 1: Update `src/app/admin/page.tsx`**

Wrap with AppShell, replace sticky header with PageHeader, update styling:

```typescript
'use client';

import { useMemo, useEffect, type FC, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, where, collectionGroup } from 'firebase/firestore';
import { type Company, type Consumption, type UserProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, startOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { DollarSign, Utensils, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppShell, PageHeader } from '@/components/layout';
import { KpiCard } from '@/components/ui/kpi-card';

const TZ = 'America/Mexico_City';

export default function AdminDashboardPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(
    () => firestore && user ? doc(firestore, `users/${user.uid}`) : null,
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companiesQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'companies')) : null,
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  const now = useMemo(() => toZonedTime(new Date(), TZ), []);
  const monthStart = useMemo(() => startOfMonth(now).toISOString(), [now]);

  const consumptionsQuery = useMemoFirebase(
    () => firestore
      ? query(collectionGroup(firestore, 'consumptions'), where('timestamp', '>=', monthStart))
      : null,
    [firestore, monthStart]
  );
  const { data: allConsumptions, isLoading: consumptionsLoading } = useCollection<Consumption>(consumptionsQuery);

  useEffect(() => {
    if (!userLoading && !user) router.push('/login');
  }, [user, userLoading, router]);

  const statsByCompany = useMemo(() => {
    if (companiesLoading || !companies) return [];
    const consumptions = allConsumptions ?? [];
    return companies.map(company => {
      const cc = consumptions.filter(
        c => c.companyId === company.id && !c.voided && c.employeeId !== 'anonymous'
      );
      const mealPrice = company.mealPrice ?? 0;
      const dailyTarget = company.dailyTarget ?? 0;
      let revenue = 0;
      if (dailyTarget > 0) {
        const days = eachDayOfInterval({ start: startOfMonth(now), end: now });
        const countByDay: Record<string, number> = {};
        cc.forEach(c => {
          const d = formatInTimeZone(new Date(c.timestamp), TZ, 'yyyy-MM-dd');
          countByDay[d] = (countByDay[d] || 0) + 1;
        });
        revenue = days.reduce((total, date) => {
          const dayStr = format(date, 'yyyy-MM-dd');
          const dow = getDay(date);
          const isChargeable = dow >= 1 && dow <= 4;
          const count = countByDay[dayStr] || 0;
          return total + (isChargeable ? Math.max(count, dailyTarget) : count) * mealPrice;
        }, 0);
      } else {
        revenue = cc.length * mealPrice;
      }
      return { id: company.id, name: company.name, mealPrice, dailyTarget, mealsServed: cc.length, revenue };
    });
  }, [companies, allConsumptions, companiesLoading, now]);

  const totals = useMemo(() =>
    statsByCompany.reduce(
      (acc, c) => ({ mealsServed: acc.mealsServed + c.mealsServed, revenue: acc.revenue + c.revenue }),
      { mealsServed: 0, revenue: 0 }
    ),
    [statsByCompany]
  );

  if (userLoading || profileLoading || companiesLoading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!user || userProfile?.role !== 'admin') {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="font-medium">Acceso Denegado</p>
            <p className="text-sm text-muted-foreground mt-1">No tiene permisos de administrador.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const monthLabel = format(now, 'MMMM yyyy', { locale: es });
  const fmtMoney = (n: number) =>
    `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Admin"
          subtitle={`Resumen mensual — ${monthLabel}`}
        />

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <KpiCard
            label="Comidas servidas"
            value={totals.mealsServed.toLocaleString()}
            icon={<Utensils size={14} />}
            loading={consumptionsLoading}
            variant="default"
          />
          <KpiCard
            label="Ingresos del mes"
            value={fmtMoney(totals.revenue)}
            icon={<DollarSign size={14} />}
            loading={consumptionsLoading}
            variant="success"
          />
        </div>

        {/* Per-company grid */}
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Por empresa
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statsByCompany.map(company => (
            <Card key={company.id} className="shadow-card hover:shadow-card-hover transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">{company.name}</CardTitle>
                  <span className="shrink-0 text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    ${company.mealPrice}/comida
                  </span>
                </div>
                {company.dailyTarget > 0 && (
                  <CardDescription className="text-xs">
                    Objetivo: {company.dailyTarget} comidas/día
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                      <Utensils size={11} /> Comidas
                    </p>
                    {consumptionsLoading ? (
                      <div className="h-6 w-12 bg-muted animate-pulse rounded" />
                    ) : (
                      <p className="text-lg font-bold font-mono">{company.mealsServed.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="rounded-md bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                      <DollarSign size={11} /> Ingresos
                    </p>
                    {consumptionsLoading ? (
                      <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                    ) : (
                      <p className="text-lg font-bold font-mono">{fmtMoney(company.revenue)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
```

**Step 2: Verify**
Open `/admin` in browser. Should show new sidebar on the left, PageHeader at top, KPI cards with Geist Mono numbers.

**Step 3: Commit**
```bash
git add src/app/admin/page.tsx
git commit -m "feat: migrate /admin to AppShell with sidebar and updated components"
```

---

## Task 8: Migrate `/costos` Page

**Files:**
- Modify: `src/app/costos/page.tsx`

**Step 1: Wrap with AppShell + PageHeader**

At the top of the return statement, replace:
```tsx
<div className="min-h-screen bg-background">
  <header className="page-header">
    <div className="page-header-inner">
      <div className="page-header-brand">
        <Logo />
        <span className="page-header-title">Costos</span>
      </div>
      <div className="flex items-center gap-2">
        <Select ...>  {/* company filter */}
        <Button onClick={() => setShowAddLabor(true)} ...>
        <Button variant="ghost" ...> {/* home */}
      </div>
    </div>
  </header>
  <main className="container mx-auto p-4 sm:p-6 lg:p-8">
    ...
  </main>
</div>
```

Replace with:
```tsx
<AppShell>
  <div className="p-6 lg:p-8 max-w-6xl mx-auto">
    <PageHeader
      title="Costos"
      subtitle={`${format(now, 'MMMM yyyy', { locale: es })} — datos del mes en curso`}
      action={
        <div className="flex items-center gap-2">
          <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cocinas</SelectItem>
              {(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowAddLabor(true)} size="sm" variant="outline" className="h-8 text-sm gap-1">
            <Plus className="h-3.5 w-3.5" /> Costo Laboral
          </Button>
        </div>
      }
    />
    {/* rest of page content */}
  </div>
</AppShell>
```

**Step 2: Replace KPI cards section**

The current 6 KPI cards use inline card markup. Replace with `<KpiCard>` components and use `font-mono` for values:
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
  <KpiCard label="Ingresos"        value={fmt(kpis.revenue)}              variant="success"     icon={<DollarSign size={12} />} loading={false} />
  <KpiCard label="Costo Alimentos" value={fmt(kpis.foodCost)}             variant="default"     icon={<TrendingDown size={12} />} />
  <KpiCard label="Costo Laboral"   value={fmt(kpis.laborCost)}            variant="default"     icon={<Users size={12} />} />
  <KpiCard label="Merma"           value={fmt(kpis.wasteCost)}            variant="destructive" icon={<AlertTriangle size={12} />} />
  <KpiCard label="% Costo Alim."   value={`${kpis.foodCostPct.toFixed(1)}%`} variant={kpis.foodCostPct > 35 ? 'warning' : 'success'} icon={<TrendingUp size={12} />} />
  <KpiCard label="Margen Neto"     value={fmt(kpis.netMargin)}            variant={kpis.netMargin >= 0 ? 'success' : 'destructive'} icon={<DollarSign size={12} />} />
</div>
```

**Step 3: Remove Logo import** (no longer needed — sidebar has the logo)
```typescript
// Remove: import { Logo } from '@/components/logo';
// Add:    import { AppShell, PageHeader } from '@/components/layout';
//         import { KpiCard } from '@/components/ui/kpi-card';
```

**Step 4: Commit**
```bash
git add src/app/costos/page.tsx
git commit -m "feat: migrate /costos to AppShell with KpiCard components"
```

---

## Task 9: Migrate `/facturacion` Page

**Files:**
- Modify: `src/app/facturacion/page.tsx`

**Step 1: Replace header with AppShell + PageHeader**

Move the month selector to the `action` prop of PageHeader. Remove Logo import. Replace KPI cards with `<KpiCard>` components.

```tsx
// Replace the return statement wrapper:
<AppShell>
  <div className="p-6 lg:p-8 max-w-6xl mx-auto">
    <PageHeader
      title="Facturación"
      subtitle={selectedMonthLabel}
      action={
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    />

    {/* KPI row */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <KpiCard label="Total Comidas"   value={totalMeals.toLocaleString()} variant="default" loading={consumptionsLoading} />
      <KpiCard label="Total Facturado" value={fmt(totalBilled)}            variant="success" loading={consumptionsLoading} />
      <KpiCard label="Cocinas"         value={(companies ?? []).length}    variant="default" />
      <KpiCard label="Pagadas"         value={paidCount}                   variant={paidCount === (companies ?? []).length ? 'success' : 'warning'} />
    </div>

    {/* Company cards */}
    ...
  </div>
</AppShell>
```

**Step 2: Update StatusBadge usage in company cards**

Replace the existing `.status-pill` spans with `<StatusBadge>`:
```tsx
// In each company card, replace the status pill in SelectTrigger:
import { StatusBadge } from '@/components/ui/status-badge';
// ...
<span><StatusBadge variant={status} /></span>
```

**Step 3: Commit**
```bash
git add src/app/facturacion/page.tsx
git commit -m "feat: migrate /facturacion to AppShell with StatusBadge components"
```

---

## Task 10: Migrate `/main` (Registros) — Critical

**Files:**
- Modify: `src/app/main/page.tsx`

> ⚠️ This is the most-used page. Changes are cosmetic only — zero logic changes.

**Step 1: Wrap with AppShell**

The current layout has a sticky header. Replace the sticky header with AppShell + PageHeader:

```tsx
// Replace outer div + header with:
<AppShell>
  <div className="p-4 sm:p-6 lg:p-8">
    <PageHeader
      title="Registros"
      subtitle={company?.name ?? ''}
      action={
        <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(companies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    />
    {/* existing two-column grid */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      ...
    </div>
  </div>
</AppShell>
```

**Step 2: Upgrade the registration input**

The number input gets a larger, more prominent treatment:
```tsx
// The input in "Por Número" tab:
<Input
  className="h-14 text-xl font-mono text-center tracking-widest"
  placeholder="Número de empleado"
  ...
/>
```

**Step 3: Upgrade the recent consumptions table**

Add proper column headers and hover state:
```tsx
<table className="w-full text-sm">
  <thead>
    <tr className="border-b border-border">
      <th className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre</th>
      <th className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Número</th>
      <th className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa</th>
      <th className="text-right pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hora</th>
    </tr>
  </thead>
  <tbody>
    {consumptions.map(c => (
      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
        <td className="py-2.5 font-medium">{c.name}</td>
        <td className="py-2.5 font-mono text-muted-foreground">{c.employeeNumber}</td>
        <td className="py-2.5 text-muted-foreground">{c.companyId}</td>
        <td className="py-2.5 font-mono text-xs text-right text-muted-foreground">
          {formatInTimeZone(new Date(c.timestamp), TZ, 'HH:mm')}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Step 4: Remove Logo import**
```typescript
// Remove: import { Logo } from '@/components/logo';
// Add:    import { AppShell, PageHeader } from '@/components/layout';
```

**Step 5: Verify all existing functionality still works**
- Register an employee by number
- Register by name search
- Import CSV
- Export CSV
- View stats tab

**Step 6: Commit**
```bash
git add src/app/main/page.tsx
git commit -m "feat: migrate /main (Registros) to AppShell — visual upgrade, zero logic changes"
```

---

## Task 11: Migrate `/inventario` Page

**Files:**
- Modify: `src/app/inventario/page.tsx`

**Step 1: Replace header with AppShell + PageHeader**

Move the Auto-Orden button and company selector to the PageHeader action slot. Remove Logo. Remove the existing `<header>` block.

```tsx
<AppShell>
  <div className="p-6 lg:p-8">
    <PageHeader
      title="Inventario"
      subtitle={company?.name}
      action={
        <div className="flex items-center gap-2">
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {lowStockCount > 0 && (
            <span className="text-xs font-medium px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded">
              {lowStockCount} bajo mínimo
            </span>
          )}
          <Button onClick={() => setShowAutoOrden(true)} size="sm" variant="outline" className="h-8 text-sm">
            Auto-Orden
          </Button>
        </div>
      }
    />
    {/* existing Tabs */}
  </div>
</AppShell>
```

**Step 2: Update tab labels with counts**
```tsx
<TabsList>
  <TabsTrigger value="stock">Stock {ingredients?.length ? `(${ingredients.length})` : ''}</TabsTrigger>
  <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
  <TabsTrigger value="proveedores">Proveedores {suppliers?.length ? `(${suppliers.length})` : ''}</TabsTrigger>
  <TabsTrigger value="ordenes">Órdenes {purchaseOrders?.length ? `(${purchaseOrders.length})` : ''}</TabsTrigger>
</TabsList>
```

**Step 3: Apply shadow-card to ingredient/supplier cards**
Replace `className="shadow-lg"` with `className="shadow-card hover:shadow-card-hover transition-shadow"` on all Cards in this page.

**Step 4: Commit**
```bash
git add src/app/inventario/page.tsx
git commit -m "feat: migrate /inventario to AppShell with tab counts"
```

---

## Task 12: Migrate `/recetas` Page

**Files:**
- Modify: `src/app/recetas/page.tsx`

**Step 1: Same pattern as /inventario**
- Wrap with `<AppShell>`
- Replace sticky header with `<PageHeader title="Recetas" action={...} />`
- Move company selector and AI plan button to PageHeader action slot
- Apply shadow-card to all Cards
- Remove Logo import, add layout imports

**Step 2: Weekly menu grid**
If the current weekly menu uses a generic layout, update day columns to be visually distinct chips:
```tsx
// Each day's meal shown as a chip:
<div className="rounded-md bg-primary/5 border border-primary/20 px-2 py-1 text-xs font-medium text-primary truncate">
  {mealName}
</div>
```

**Step 3: Commit**
```bash
git add src/app/recetas/page.tsx
git commit -m "feat: migrate /recetas to AppShell"
```

---

## Task 13: Migrate `/configuracion` Page

**Files:**
- Modify: `src/app/configuracion/page.tsx`

**Step 1: Wrap with AppShell + PageHeader**
```tsx
<AppShell>
  <div className="p-6 lg:p-8 max-w-5xl mx-auto">
    <PageHeader title="Configuración" subtitle="Empresas, menús y usuarios" />
    {/* existing Tabs */}
  </div>
</AppShell>
```

**Step 2: Convert tab layout to vertical settings panel**

Replace the current `<TabsList>` + `<TabsContent>` with a side-panel layout:
```tsx
<div className="flex gap-8">
  {/* Vertical tab list */}
  <div className="w-48 shrink-0">
    <nav className="space-y-1">
      {['Empresas', 'Menús', 'Usuarios'].map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab.toLowerCase())}
          className={cn(
            'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
            activeTab === tab.toLowerCase()
              ? 'bg-primary/5 text-primary font-medium border-l-2 border-primary pl-[10px]'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent pl-[10px]'
          )}
        >
          {tab}
        </button>
      ))}
    </nav>
  </div>
  {/* Content */}
  <div className="flex-1 min-w-0">
    {/* tab content panels */}
  </div>
</div>
```
> Note: Replace the shadcn Tabs with this pattern, keeping all existing form logic unchanged.

**Step 3: Commit**
```bash
git add src/app/configuracion/page.tsx
git commit -m "feat: migrate /configuracion to AppShell with vertical settings panel"
```

---

## Task 14: Migrate `/kiosk`, `/pos-inditex`, `/command`

**Files:**
- Modify: `src/app/kiosk/page.tsx`
- Modify: `src/app/pos-inditex/page.tsx`
- Modify: `src/app/command/page.tsx`

**Step 1: For each of the three pages**

Pattern is identical — wrap with AppShell, replace header, no other layout changes:
```tsx
// Remove: import { Logo } from '@/components/logo';
// Remove: <header className="page-header">...</header>
// Add:    import { AppShell, PageHeader } from '@/components/layout';
// Wrap:   <AppShell><div className="p-4 sm:p-6"><PageHeader title="[Page Name]" /></div></AppShell>
```

Kiosk → `title="Kiosk Televisa"`
POS Inditex → `title="POS Inditex"`
Command → `title="Comanda"`

**Step 2: Apply card/button upgrades**
Replace `shadow-lg` with `shadow-card` on all Cards. That's all — these pages stay functionally identical.

**Step 3: Commit**
```bash
git add src/app/kiosk/page.tsx src/app/pos-inditex/page.tsx src/app/command/page.tsx
git commit -m "feat: migrate kiosk, POS, and command pages to AppShell"
```

---

## Task 15: Migrate `/selection` — Home Dashboard

**Files:**
- Modify: `src/app/selection/page.tsx`

**Step 1: Wrap with AppShell + PageHeader**

```tsx
<AppShell>
  <div className="p-6 lg:p-8 max-w-5xl mx-auto">
    <PageHeader
      title="Inicio"
      subtitle={`Bienvenido${firstName ? `, ${firstName}` : ''}`}
    />
    {/* content */}
  </div>
</AppShell>
```

**Step 2: Add live stats row**

The selection page now becomes a home dashboard. Add a top KPI row showing live data for today:
```tsx
{/* Live KPIs — today at a glance */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
  <KpiCard label="Comidas hoy"         value={todayCount.toLocaleString()} loading={consumptionsLoading} />
  <KpiCard label="Ingresos este mes"   value={fmtMoney(monthlyRevenue)}    loading={consumptionsLoading} variant="success" />
  <KpiCard label="Empresas activas"    value={companies?.length ?? 0}      variant="default" />
</div>
```

You will need to add the same collectionGroup query for today's consumptions that `/admin` uses. Copy the pattern from admin — query `collectionGroup('consumptions')` with `where('timestamp', '>=', monthStart)`.

**Step 3: Simplify nav tiles**

Keep the existing nav tiles but reduce them to compact icon+label buttons in a grid — they're secondary now that the sidebar handles navigation:
```tsx
<SectionLabel>Acceso rápido</SectionLabel>
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
  {NAV_ITEMS.map(item => (
    <button
      key={item.href}
      onClick={() => router.push(item.href)}
      className="flex items-center gap-2.5 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium"
    >
      <item.icon size={16} className="text-muted-foreground shrink-0" />
      {item.label}
    </button>
  ))}
</div>
```

**Step 4: Remove the logout button** (now in sidebar footer) and Logo (now in sidebar).

**Step 5: Commit**
```bash
git add src/app/selection/page.tsx
git commit -m "feat: transform /selection into live Home Dashboard with KPIs"
```

---

## Task 16: Redesign Auth Pages (Login + Signup)

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/signup/page.tsx`

**Step 1: Update `src/app/login/page.tsx`** — split panel layout:

```tsx
export default function LoginPage() {
  // ... existing state and handlers unchanged ...

  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
        <div className="relative z-10 text-white text-center">
          <Logo className="brightness-0 invert mb-8 mx-auto" />
          <p className="text-lg font-medium opacity-90">Gestión de comedores empresariales</p>
          <p className="text-sm opacity-60 mt-2">Vidana · México</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Logo className="mx-auto" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-1">Iniciar sesión</h2>
          <p className="text-sm text-muted-foreground mb-8">Ingresa tus credenciales para continuar</p>

          {/* Existing form JSX unchanged — just remove the Card wrapper */}
          <div className="space-y-4">
            {/* email input */}
            {/* password input */}
            {/* submit button */}
            {/* google button */}
            {/* forgot password */}
            {/* signup link */}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Apply same split-panel pattern to `src/app/signup/page.tsx`**
Same structure, change title to "Crear cuenta" and subtitle to "Completa el formulario para registrarte".

**Step 3: Commit**
```bash
git add src/app/login/page.tsx src/app/signup/page.tsx
git commit -m "feat: redesign auth pages with split-panel brand layout"
```

---

## Task 17: Final Cleanup — globals.css

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Remove old utility classes**

Once all pages have been migrated, delete these blocks from `globals.css`:
```css
/* DELETE the following @layer components blocks: */
.page-header { ... }
.page-header-inner { ... }
.page-header-brand { ... }
.page-header-title { ... }
.nav-tile { ... }
.nav-tile-icon { ... }
.kpi-card { ... }
.kpi-card-blue { ... }
.kpi-card-green { ... }
.kpi-card-amber { ... }
.kpi-card-red { ... }
.status-pill { ... }
.status-pill-pendiente { ... }
.status-pill-enviado { ... }
.status-pill-pagado { ... }
.section-label { ... }
```

**Step 2: Verify no build errors**
```bash
npx tsc --noEmit 2>&1 | grep -v "functions/\|billing-generators"
```
Expected: no errors (the two pre-existing errors from functions/ and billing-generators are expected and unrelated).

**Step 3: Run dev and spot-check all pages**
- `/login` — split panel
- `/selection` — home dashboard with sidebar
- `/main` — registros with sidebar
- `/admin` — KPI cards + company grid
- `/inventario` — tabs with counts

**Step 4: Final commit**
```bash
git add src/app/globals.css
git commit -m "chore: remove obsolete page-header, nav-tile, kpi-card, status-pill CSS classes"
```

---

## Task 18: Push to GitHub

**Step 1: Push all commits**
```bash
git push origin main
```

Firebase App Hosting will automatically deploy from the GitHub push.

**Step 2: Verify deployment**
Check the Firebase Console → App Hosting for build status. The app at the production URL should reflect all changes within ~3 minutes of push.

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `geist` dependency |
| `src/app/layout.tsx` | Geist font setup |
| `src/app/globals.css` | New CSS variables, remove old utility classes |
| `tailwind.config.ts` | Font family, sidebar color, custom shadows |
| `src/components/layout/app-shell.tsx` | **New** — main layout wrapper |
| `src/components/layout/sidebar.tsx` | **New** — persistent sidebar |
| `src/components/layout/sidebar-nav.tsx` | **New** — nav items + active state |
| `src/components/layout/page-header.tsx` | **New** — page title component |
| `src/components/layout/mobile-top-bar.tsx` | **New** — mobile hamburger bar |
| `src/components/layout/index.ts` | **New** — barrel export |
| `src/components/ui/kpi-card.tsx` | **New** — metric card component |
| `src/components/ui/status-badge.tsx` | **New** — status pill component |
| `src/components/ui/section-label.tsx` | **New** — section heading component |
| `src/app/admin/page.tsx` | Migrated to AppShell |
| `src/app/costos/page.tsx` | Migrated to AppShell |
| `src/app/facturacion/page.tsx` | Migrated to AppShell |
| `src/app/main/page.tsx` | Migrated to AppShell — visual only |
| `src/app/inventario/page.tsx` | Migrated to AppShell |
| `src/app/recetas/page.tsx` | Migrated to AppShell |
| `src/app/configuracion/page.tsx` | Migrated + vertical settings layout |
| `src/app/kiosk/page.tsx` | Migrated to AppShell |
| `src/app/pos-inditex/page.tsx` | Migrated to AppShell |
| `src/app/command/page.tsx` | Migrated to AppShell |
| `src/app/selection/page.tsx` | Transformed to Home Dashboard |
| `src/app/login/page.tsx` | Split-panel redesign |
| `src/app/signup/page.tsx` | Split-panel redesign |

**Zero changes to:** any Firebase hooks, Firestore queries, data types, business logic, AI flows, billing generators, Cloud Functions.
