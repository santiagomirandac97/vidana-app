'use client';

import { useState, useMemo, useRef } from 'react';
import { doc, collection, query, where } from 'firebase/firestore';
import { useUser, useFirebase, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import type { UserProfile, Company, MenuItem, MenuSchedule } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { MenuHero } from '@/components/order/menu-hero';
import { CategoryPills } from '@/components/order/category-pills';
import { MenuCard } from '@/components/order/menu-card';
import { ItemDetailSheet } from '@/components/order/item-detail-sheet';
import { FloatingCartBar } from '@/components/order/floating-cart-bar';
import { useCart } from '@/context/cart-context';
import { Search, X, UtensilsCrossed, ShoppingBag } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function isScheduleActiveNow(schedule: MenuSchedule): boolean {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sun … 6=Sat

  // Check day of week
  if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
    if (!schedule.daysOfWeek.includes(currentDay)) return false;
  }

  // Check time restriction
  if (schedule.timeRestriction) {
    const { startTime, endTime } = schedule.timeRestriction;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    if (nowMins < startMins || nowMins > endMins) return false;
  }

  return true;
}

// ─── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonCardGrid() {
  return (
    <div className="px-4 md:px-6 lg:px-8 space-y-4">
      {/* Hero skeleton */}
      <Skeleton className="h-32 md:h-40 rounded-2xl" />
      {/* Search skeleton */}
      <Skeleton className="h-11 rounded-xl" />
      {/* Pills skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-full shrink-0" />
        ))}
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden bg-white shadow-sm">
            <Skeleton className="aspect-[4/3] w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function OrderPage() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { orderType, setOrderType } = useCart();

  // 1. Fetch user profile
  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const companyId = userProfile?.companyId;

  // 2. Fetch company
  const companyDocRef = useMemoFirebase(
    () => (firestore && companyId ? doc(firestore, `companies/${companyId}`) : null),
    [firestore, companyId]
  );
  const { data: company } = useDoc<Company>(companyDocRef);

  // 3. Fetch active menu schedules
  const schedulesQuery = useMemoFirebase(
    () =>
      firestore && companyId
        ? query(
            collection(firestore, `companies/${companyId}/menuSchedules`),
            where('active', '==', true)
          )
        : null,
    [firestore, companyId]
  );
  const { data: schedules, isLoading: schedulesLoading } = useCollection<MenuSchedule>(schedulesQuery);

  // 4. Filter schedules active right now
  const activeSchedules = useMemo(
    () => (schedules ?? []).filter(isScheduleActiveNow),
    [schedules]
  );

  // 5. Collect all menuItemIds from active schedules
  const allItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const schedule of activeSchedules) {
      for (const id of schedule.menuItemIds) ids.add(id);
    }
    return Array.from(ids);
  }, [activeSchedules]);

  // 6. Fetch menu items — query all items for the company, then filter client-side
  //    (Firestore "in" queries max 30 items; fetching all company items is simpler)
  const menuItemsQuery = useMemoFirebase(
    () =>
      firestore && companyId
        ? query(collection(firestore, `companies/${companyId}/menuItems`))
        : null,
    [firestore, companyId]
  );
  const { data: allMenuItems, isLoading: itemsLoading } = useCollection<MenuItem>(menuItemsQuery);

  // 7. Filter to only items in active schedules
  const menuItems = useMemo(() => {
    if (!allMenuItems) return [];
    if (allItemIds.length === 0 && activeSchedules.length === 0) {
      // No active schedules at all — show all items as fallback
      return allMenuItems;
    }
    if (allItemIds.length === 0) return [];
    const idSet = new Set(allItemIds);
    return allMenuItems.filter((item) => idSet.has(item.id));
  }, [allMenuItems, allItemIds, activeSchedules.length]);

  // 8. Extract categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of menuItems) {
      if (item.category) cats.add(item.category);
    }
    return Array.from(cats).sort();
  }, [menuItems]);

  // State
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isSearching = searchQuery.trim().length > 0;

  // Filter items by search or category
  const visibleItems = useMemo(() => {
    if (isSearching) {
      const q = searchQuery.trim().toLowerCase();
      return menuItems.filter((i) => i.name.toLowerCase().includes(q));
    }
    return activeCategory === 'Todos'
      ? menuItems
      : menuItems.filter((i) => i.category === activeCategory);
  }, [menuItems, activeCategory, searchQuery, isSearching]);

  // Group items by category for section headers
  const groupedItems = useMemo(() => {
    if (isSearching || activeCategory !== 'Todos') return null;
    const groups: { category: string; items: MenuItem[] }[] = [];
    const catMap = new Map<string, MenuItem[]>();
    for (const item of visibleItems) {
      const cat = item.category || 'Otros';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(item);
    }
    const sortedCats = Array.from(catMap.keys()).sort();
    for (const cat of sortedCats) {
      groups.push({ category: cat, items: catMap.get(cat)! });
    }
    return groups;
  }, [visibleItems, isSearching, activeCategory]);

  const isLoading = profileLoading || schedulesLoading || itemsLoading;

  if (isLoading) {
    return <SkeletonCardGrid />;
  }

  const handleTapItem = (item: MenuItem) => {
    setSelectedItem(item);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-3 pb-4">
      <MenuHero
        schedules={activeSchedules}
        companyName={(company as any)?.portalDisplayName ?? company?.name ?? ''}
      />

      {/* Order type toggle — only shown when take away is enabled */}
      {(company as any)?.takeAwayEnabled && (
        <div className="px-4 md:px-6 lg:px-8 pt-1">
          <div className="inline-flex rounded-full border border-border/40 bg-muted/30 p-1 gap-1">
            <button
              onClick={() => setOrderType('eat_in')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                orderType === 'eat_in'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UtensilsCrossed size={15} />
              Comer aquí
            </button>
            <button
              onClick={() => setOrderType('take_away')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                orderType === 'take_away'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShoppingBag size={15} />
              Para llevar
            </button>
          </div>
        </div>
      )}

      <div className="px-4 md:px-6 lg:px-8 space-y-3">
      {menuItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground text-sm">
            No hay platillos disponibles en este momento.
          </p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            Vuelve a intentar mas tarde.
          </p>
        </div>
      ) : (
        <>
          {/* Sticky search bar */}
          <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm pb-1 pt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en el menú..."
                className="w-full rounded-xl bg-muted/50 px-4 py-2.5 pl-10 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {!isSearching && (
            <CategoryPills
              categories={categories}
              active={activeCategory}
              onSelect={setActiveCategory}
            />
          )}

          {/* Grouped view with category headers */}
          {groupedItems ? (
            <div>
              {groupedItems.map((group) => (
                <div key={group.category}>
                  <h2 className="text-lg font-bold mt-6 mb-3">{group.category}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {group.items.map((item) => (
                      <MenuCard
                        key={item.id}
                        menuItem={item}
                        onTap={() => handleTapItem(item)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {visibleItems.map((item) => (
                <MenuCard
                  key={item.id}
                  menuItem={item}
                  onTap={() => handleTapItem(item)}
                />
              ))}
            </div>
          )}

          {visibleItems.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground text-sm">
                {isSearching
                  ? 'No se encontraron resultados.'
                  : 'No hay platillos en esta categoria.'}
              </p>
            </div>
          )}
        </>
      )}

      <ItemDetailSheet
        menuItem={selectedItem}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />

      <FloatingCartBar />
      </div>
    </div>
  );
}
