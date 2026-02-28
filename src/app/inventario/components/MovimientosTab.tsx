'use client';

import { type StockMovement, type MovementType } from '@/lib/types';
import { formatInTimeZone } from 'date-fns-tz';

import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

import { TIME_ZONE } from './constants';

// ─── MovimientosTab ───────────────────────────────────────────────────────────

interface MovimientosTabProps {
  movements: (StockMovement & { id: string })[];
  isLoading: boolean;
}

export function MovimientosTab({ movements, isLoading }: MovimientosTabProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const movementTypeColor: Record<MovementType, string> = {
    entrada: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    salida: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    ajuste: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    merma: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Historial de Movimientos</h2>
      {movements.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">No hay movimientos registrados.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Ingrediente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Costo Unitario</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatInTimeZone(new Date(m.timestamp), TIME_ZONE, 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="font-medium">{m.ingredientName}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${movementTypeColor[m.type]}`}
                    >
                      {m.type}
                    </span>
                  </TableCell>
                  <TableCell>{m.quantity}</TableCell>
                  <TableCell>${m.unitCost.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.reason ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
