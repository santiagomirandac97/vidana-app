'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Info, FileText, Shield } from 'lucide-react';

interface LegalLinksPopoverProps {
  termsUrl?: string;
  privacyUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerClassName?: string;
}

export function LegalLinksPopover({ termsUrl, privacyUrl, open, onOpenChange, triggerClassName }: LegalLinksPopoverProps) {
  // Don't render if no URLs configured
  if (!termsUrl && !privacyUrl) return null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={triggerClassName ?? 'p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground'}
          aria-label="Información legal"
        >
          <Info size={18} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          {termsUrl && (
            <a
              href={termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <FileText size={15} className="text-muted-foreground" />
              Términos y Condiciones
            </a>
          )}
          {privacyUrl && (
            <a
              href={privacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Shield size={15} className="text-muted-foreground" />
              Política de Privacidad
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
