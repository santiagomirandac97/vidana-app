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
