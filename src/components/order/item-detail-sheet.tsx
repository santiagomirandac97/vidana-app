'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { UtensilsCrossed, Minus, Plus, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useCart } from '@/context/cart-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { MenuItem, MenuItemModifier } from '@/lib/types';

interface ItemDetailSheetProps {
  menuItem: MenuItem | null;
  open: boolean;
  onClose: () => void;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

export function ItemDetailSheet({ menuItem, open, onClose }: ItemDetailSheetProps) {
  const isMobile = useIsMobile();
  const cart = useCart();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  // Reset state when item changes
  useEffect(() => {
    if (open) {
      setQuantity(1);
      setSelectedModifiers([]);
      setSpecialInstructions('');
      setShowInstructions(false);
    }
  }, [open, menuItem?.id]);

  const toggleModifier = useCallback((modId: string) => {
    setSelectedModifiers((prev) =>
      prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]
    );
  }, []);

  if (!menuItem) return null;

  // Group modifiers
  const modifierGroups: Record<string, MenuItemModifier[]> = {};
  if (menuItem.modifiers) {
    for (const mod of menuItem.modifiers) {
      if (!modifierGroups[mod.group]) modifierGroups[mod.group] = [];
      modifierGroups[mod.group].push(mod);
    }
  }

  const modifierTotal = selectedModifiers.reduce((sum, modId) => {
    const mod = menuItem.modifiers?.find((m) => m.id === modId);
    return sum + (mod?.priceAdjustment ?? 0);
  }, 0);

  const unitPrice = menuItem.price + modifierTotal;
  const total = unitPrice * quantity;

  const handleAdd = () => {
    cart.addItem({
      menuItem,
      quantity,
      selectedModifiers,
      specialInstructions,
    });
    toast({ title: 'Agregado al carrito', description: `${quantity}x ${menuItem.name}` });
    onClose();
  };

  const sheetContent = (
    <div className="flex flex-col max-h-[85vh] md:max-h-[90vh]">
      {/* Image */}
      <div className="relative w-full aspect-video bg-gradient-to-br from-muted to-muted/60 rounded-t-2xl overflow-hidden shrink-0">
        {menuItem.imageUrl ? (
          <Image
            src={menuItem.imageUrl}
            alt={menuItem.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 500px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <UtensilsCrossed size={48} className="text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
        <h2 className="text-xl font-bold text-foreground">{menuItem.name}</h2>
        {menuItem.description && (
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {menuItem.description}
          </p>
        )}
        <p className="mt-2 text-lg font-mono font-semibold text-green-600">
          ${menuItem.price.toFixed(2)}
        </p>

        {/* Modifiers */}
        {Object.keys(modifierGroups).length > 0 && (
          <div className="mt-5 space-y-4">
            {Object.entries(modifierGroups).map(([group, mods]) => (
              <div key={group}>
                <h3 className="text-sm font-semibold text-foreground mb-2">{group}</h3>
                <div className="space-y-2">
                  {mods.map((mod) => (
                    <label
                      key={mod.id}
                      className="flex items-center gap-3 cursor-pointer py-1"
                    >
                      <Checkbox
                        checked={selectedModifiers.includes(mod.id)}
                        onCheckedChange={() => toggleModifier(mod.id)}
                      />
                      <span className="flex-1 text-sm text-foreground">{mod.name}</span>
                      {mod.priceAdjustment > 0 && (
                        <span className="text-sm font-mono text-muted-foreground">
                          + ${mod.priceAdjustment.toFixed(2)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Special instructions */}
        <div className="mt-5">
          <button
            onClick={() => setShowInstructions((p) => !p)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              size={16}
              className={cn('transition-transform', showInstructions && 'rotate-180')}
            />
            Instrucciones especiales
          </button>
          {showInstructions && (
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Ej: Sin cebolla, extra salsa..."
              className="mt-2 w-full rounded-xl border border-border bg-white p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          )}
        </div>
      </div>

      {/* Bottom bar: quantity + add button */}
      <div className="shrink-0 px-5 py-4 border-t border-border/50 space-y-3">
        {/* Quantity selector */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-4 bg-muted/60 rounded-xl px-3 py-1.5">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors"
            >
              <Minus size={16} />
            </button>
            <span className="text-lg font-semibold w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Add to cart button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          className="w-full bg-primary text-white rounded-xl py-3.5 font-semibold text-base shadow-sm hover:bg-primary/90 transition-colors"
        >
          Agregar al carrito — <span className="font-mono">${total.toFixed(2)}</span>
        </motion.button>
      </div>
    </div>
  );

  // Mobile: Framer Motion bottom sheet
  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-50 bg-black/60"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  onClose();
                }
              }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[90vh] overflow-hidden"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>
              {sheetContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: shadcn Dialog
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl gap-0">
        <DialogTitle className="sr-only">{menuItem.name}</DialogTitle>
        {sheetContent}
      </DialogContent>
    </Dialog>
  );
}
