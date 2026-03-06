'use client';

import { useState, type FC } from 'react';
import { type Employee } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserCheck, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmployeeSelectorProps {
  employees: Employee[];
  selected: Employee | null;
  onSelect: (employee: Employee) => void;
  onClear: () => void;
}

export const EmployeeSelector: FC<EmployeeSelectorProps> = ({
  employees, selected, onSelect, onClear,
}) => {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? employees.filter(e =>
        e.active && !e.voided && (
          e.name.toLowerCase().includes(query.toLowerCase()) ||
          e.employeeNumber.includes(query)
        )
      )
    : [];

  if (selected) {
    return (
      <Card className="shadow-card border-primary">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">{selected.name}</p>
              <p className="text-xs text-muted-foreground font-mono">#{selected.employeeNumber}</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="h-4 w-4" />
          Seleccionar Empleado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nombre o número..."
            className="pl-8"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        {filtered.length > 0 && (
          <ScrollArea className="h-48 border rounded-md">
            <div className="p-1">
              {filtered.map(emp => (
                <button
                  key={emp.employeeNumber}
                  onClick={() => { onSelect(emp); setQuery(''); }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors flex items-center justify-between'
                  )}
                >
                  <span className="text-sm font-medium">{emp.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">#{emp.employeeNumber}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
        {query.trim() && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Sin resultados</p>
        )}
      </CardContent>
    </Card>
  );
};
