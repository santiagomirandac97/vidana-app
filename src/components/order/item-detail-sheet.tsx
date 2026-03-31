'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { UtensilsCrossed, Minus, Plus, ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCart } from '@/context/cart-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { MenuItem, MenuItemModifier, ModifierGroupMeta } from '@/lib/types';

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

  const toggleModifier = useCallback(
    (modId: string, groupMods: MenuItemModifier[], groupMeta?: ModifierGroupMeta) => {
      setSelectedModifiers((prev) => {
        if (prev.includes(modId)) {
          return prev.filter((id) => id !== modId);
        }
        // Enforce maxSelections if defined
        if (groupMeta?.maxSelections !== undefined) {
          const selectedCountInGroup = prev.filter((id) => groupMods.some((m) => m.id === id)).length;
          if (selectedCountInGroup >= groupMeta.maxSelections) {
            return prev; // at max, don't add
          }
        }
        return [...prev, modId];
      });
    },
    []
  );

  const selectSingleModifier = useCallback((groupMods: MenuItemModifier[], modId: string) => {
    setSelectedModifiers((prev) => {
      // Remove any existing selection from this group, then add the new one
      const groupIds = new Set(groupMods.map((m) => m.id));
      const withoutGroup = prev.filter((id) => !groupIds.has(id));
      return [...withoutGroup, modId];
    });
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

  // Determine if a group is single-select: groups where options are mutually exclusive.
  // If maxSelections === 1 on the group meta, treat as single-select.
  // Otherwise fall back to heuristic: groups with <= 4 items are treated as single-select.
  const isSingleSelectGroup = (
    _group: string,
    mods: MenuItemModifier[],
    groupMeta?: ModifierGroupMeta
  ): boolean => {
    if (groupMeta?.maxSelections !== undefined) {
      return groupMeta.maxSelections === 1;
    }
    // Fallback heuristic for backwards compatibility
    return mods.length <= 4;
  };

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
      {/* Image — edge-to-edge */}
      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-muted to-muted/60 overflow-hidden shrink-0">
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
        {/* Gradient overlay at bottom of image */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm hover:bg-white transition-colors z-10"
        >
          <X size={18} className="text-foreground" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
        {/* Name + price row */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-foreground">{menuItem.name}</h2>
          <span className="text-lg font-semibold text-primary whitespace-nowrap font-mono">
            ${menuItem.price.toFixed(2)}
          </span>
        </div>
        {menuItem.description && (
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {menuItem.description}
          </p>
        )}

        {/* Modifiers */}
        {Object.keys(modifierGroups).length > 0 && (
          <div className="mt-4">
            {Object.entries(modifierGroups).map(([group, mods]) => {
              const groupMeta = menuItem.modifierGroupMeta?.[group];
              const singleSelect = isSingleSelectGroup(group, mods, groupMeta);
              const selectedInGroup = selectedModifiers.find((id) =>
                mods.some((m) => m.id === id)
              );
              const selectedCountInGroup = selectedModifiers.filter((id) =>
                mods.some((m) => m.id === id)
              ).length;

              return (
                <div key={group}>
                  <div className="flex items-center gap-2 mt-5 mb-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </h3>
                    {groupMeta?.maxSelections && groupMeta.maxSelections > 1 && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                        Máx {groupMeta.maxSelections}
                      </span>
                    )}
                  </div>

                  {singleSelect ? (
                    <RadioGroup
                      value={selectedInGroup ?? ''}
                      onValueChange={(val) => selectSingleModifier(mods, val)}
                    >
                      {mods.map((mod, idx) => (
                        <label
                          key={mod.id}
                          className={cn(
                            'flex items-center gap-3 cursor-pointer py-3',
                            idx < mods.length - 1 && 'border-b border-border/30'
                          )}
                        >
                          <RadioGroupItem value={mod.id} />
                          <span className="flex-1 text-sm text-foreground">{mod.name}</span>
                          {mod.priceAdjustment > 0 && (
                            <span className="text-sm font-mono text-muted-foreground">
                              + ${mod.priceAdjustment.toFixed(2)}
                            </span>
                          )}
                        </label>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div>
                      {mods.map((mod, idx) => {
                        const isChecked = selectedModifiers.includes(mod.id);
                        const atMax =
                          groupMeta?.maxSelections !== undefined &&
                          selectedCountInGroup >= groupMeta.maxSelections &&
                          !isChecked;
                        return (
                          <label
                            key={mod.id}
                            className={cn(
                              'flex items-center gap-3 cursor-pointer py-3',
                              idx < mods.length - 1 && 'border-b border-border/30',
                              atMax && 'opacity-40 cursor-not-allowed'
                            )}
                          >
                            <Checkbox
                              checked={isChecked}
                              disabled={atMax}
                              onCheckedChange={() => toggleModifier(mod.id, mods, groupMeta)}
                            />
                            <span className="flex-1 text-sm text-foreground">{mod.name}</span>
                            {mod.priceAdjustment > 0 && (
                              <span className="text-sm font-mono text-muted-foreground">
                                + ${mod.priceAdjustment.toFixed(2)}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Special instructions — collapsible */}
        <div className="mt-5 mb-2">
          <button
            onClick={() => setShowInstructions((p) => !p)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <ChevronDown
              size={16}
              className={cn('transition-transform duration-200', showInstructions && 'rotate-180')}
            />
            Instrucciones especiales
          </button>
          <AnimatePresence>
            {showInstructions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 rounded-xl border bg-muted/20 p-3">
                  <textarea
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="Ej: Sin cebolla, extra salsa..."
                    className="w-full bg-transparent text-sm resize-none h-20 focus:outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom sticky bar */}
      <div className="shrink-0 px-5 py-4 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)] space-y-3">
        {/* Quantity selector — pill shaped */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-5 rounded-full border border-border px-4 py-1.5">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
            >
              <Minus size={16} className={cn(quantity <= 1 && 'text-muted-foreground/40')} />
            </button>
            <span className="text-lg font-semibold w-6 text-center tabular-nums">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Add to cart button — full width pill */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          className="w-full bg-primary text-white rounded-full py-4 font-semibold text-base shadow-sm hover:bg-primary/90 transition-colors"
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
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl gap-0 [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">{menuItem.name}</DialogTitle>
        {sheetContent}
      </DialogContent>
    </Dialog>
  );
}
