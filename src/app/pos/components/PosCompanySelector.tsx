'use client';

import { type FC } from 'react';
import { type Company } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

interface PosCompanySelectorProps {
  companies: Company[];
  selectedId: string | null;
  onChange: (id: string) => void;
}

export const PosCompanySelector: FC<PosCompanySelectorProps> = ({ companies, selectedId, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={selectedId ?? ''} onValueChange={onChange}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Seleccionar empresa..." />
        </SelectTrigger>
        <SelectContent>
          {companies.map(c => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
