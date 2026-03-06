'use client';

import { useMemo, type FC } from 'react';
import { type MenuItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Utensils, PlusCircle } from 'lucide-react';

interface MenuGridProps {
  menuItems: MenuItem[];
  onAdd: (item: MenuItem) => void;
  disabled?: boolean;
}

export const MenuGrid: FC<MenuGridProps> = ({ menuItems, onAdd, disabled = false }) => {
  const grouped = useMemo(() => {
    return menuItems.reduce((acc, item) => {
      const cat = item.category || 'Varios';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menuItems]);

  const categories = Object.keys(grouped);

  if (categories.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Utensils className="h-12 w-12 mb-4" />
          <p>No hay productos en el menú.</p>
          <p className="text-sm">Añada productos desde Configuración.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          Menú
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={categories[0]}>
          <TabsList className="flex-wrap h-auto gap-1 mb-4">
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
            ))}
          </TabsList>
          {categories.map(cat => (
            <TabsContent key={cat} value={cat}>
              <ScrollArea className="h-[55vh] pr-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
                  {grouped[cat].map(item => (
                    <button
                      key={item.id}
                      onClick={() => !disabled && onAdd(item)}
                      disabled={disabled}
                      className="group relative flex flex-col items-center justify-center p-3 text-center bg-background rounded-lg border-2 border-border hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 aspect-square"
                    >
                      <p className="font-semibold text-sm leading-tight">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">${item.price.toFixed(2)}</p>
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlusCircle className="h-4 w-4 text-primary" />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
