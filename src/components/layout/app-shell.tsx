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
        <SheetContent side="left" className="p-0 w-[80vw] max-w-60">
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
