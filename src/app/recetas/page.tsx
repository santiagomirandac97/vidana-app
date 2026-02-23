'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import {
  collection,
  query,
  orderBy,
  doc,
  setDoc,
} from 'firebase/firestore';
import {
  type Ingredient,
  type MenuItem,
  type Recipe,
  type RecipeIngredient,
  type WeeklyMenu,
  type DayOfWeek,
  type UserProfile,
  type Company,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { startOfWeek } from 'date-fns';
import { toZonedTime, format as formatTZ } from 'date-fns-tz';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Logo } from '@/components/logo';
import {
  ShieldAlert,
  Home,
  Loader2,
  Plus,
  X,
  BookOpen,
  Calendar,
  ShoppingCart,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_ZONE = 'America/Mexico_City';

const DAYS_OF_WEEK: { key: DayOfWeek; label: string }[] = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
];

// ─── Helper: current week start (Monday, Mexico City TZ) ──────────────────────

function getWeekStartDate(): string {
  const nowInMx = toZonedTime(new Date(), TIME_ZONE);
  const monday = startOfWeek(nowInMx, { weekStartsOn: 1 });
  return formatTZ(monday, 'yyyy-MM-dd', { timeZone: TIME_ZONE });
}

// ─── Recipe Builder Row type ──────────────────────────────────────────────────

interface RecipeRow {
  id: string; // local key
  ingredientId: string;
  quantity: number;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RecetasPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loadTimeout, setLoadTimeout] = useState(false);

  // ── Company selector from localStorage ──────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('selectedCompanyId');
    if (stored) setSelectedCompanyId(stored);
  }, []);

  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id);
    localStorage.setItem('selectedCompanyId', id);
  };

  // ── Load timeout guard ───────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setLoadTimeout(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  // ── Auth redirect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  // ── User profile ─────────────────────────────────────────────────────────
  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  // ── Companies list ───────────────────────────────────────────────────────
  const companiesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null),
    [firestore]
  );
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  // ── Auto-select first company if none stored ─────────────────────────────
  useEffect(() => {
    if (!selectedCompanyId && companies && companies.length > 0) {
      const firstId = companies[0].id;
      setSelectedCompanyId(firstId);
      localStorage.setItem('selectedCompanyId', firstId);
    }
  }, [companies, selectedCompanyId]);

  // ── Menu items ───────────────────────────────────────────────────────────
  const menuItemsQuery = useMemoFirebase(
    () =>
      firestore && selectedCompanyId
        ? query(
            collection(firestore, `companies/${selectedCompanyId}/menuItems`),
            orderBy('name')
          )
        : null,
    [firestore, selectedCompanyId]
  );
  const { data: menuItems } = useCollection<MenuItem>(menuItemsQuery);

  // ── Ingredients ──────────────────────────────────────────────────────────
  const ingredientsQuery = useMemoFirebase(
    () =>
      firestore && selectedCompanyId
        ? query(
            collection(firestore, `companies/${selectedCompanyId}/ingredients`),
            orderBy('name')
          )
        : null,
    [firestore, selectedCompanyId]
  );
  const { data: ingredients } = useCollection<Ingredient>(ingredientsQuery);

  // ── Recipes ──────────────────────────────────────────────────────────────
  const recipesQuery = useMemoFirebase(
    () =>
      firestore && selectedCompanyId
        ? query(collection(firestore, `companies/${selectedCompanyId}/recipes`))
        : null,
    [firestore, selectedCompanyId]
  );
  const { data: recipes } = useCollection<Recipe>(recipesQuery);

  // ── Recipes map for O(1) lookup ───────────────────────────────────────────
  const recipesMap = useMemo<Record<string, Recipe>>(() => {
    if (!recipes) return {};
    return recipes.reduce<Record<string, Recipe>>((acc, r) => {
      acc[r.menuItemId] = r;
      return acc;
    }, {});
  }, [recipes]);

  // ── Ingredients map for O(1) lookup ──────────────────────────────────────
  const ingredientsMap = useMemo<Record<string, Ingredient>>(() => {
    if (!ingredients) return {};
    return ingredients.reduce<Record<string, Ingredient>>((acc, ing) => {
      if (ing.id) acc[ing.id] = ing;
      return acc;
    }, {});
  }, [ingredients]);

  // ── Weekly menu ──────────────────────────────────────────────────────────
  const weekStartDate = useMemo(() => getWeekStartDate(), []);

  const weeklyMenuRef = useMemoFirebase(
    () =>
      firestore && selectedCompanyId
        ? doc(firestore, `companies/${selectedCompanyId}/weeklyMenus/${weekStartDate}`)
        : null,
    [firestore, selectedCompanyId, weekStartDate]
  );
  const { data: weeklyMenu } = useDoc<WeeklyMenu>(weeklyMenuRef);

  // ── Page loading state ───────────────────────────────────────────────────
  const pageIsLoading = userLoading || profileLoading || companiesLoading;

  // ─── Loading screen ──────────────────────────────────────────────────────
  if (pageIsLoading && !loadTimeout) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="ml-4 text-lg">Cargando...</p>
      </div>
    );
  }

  if (loadTimeout && pageIsLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Card className="w-full max-w-sm mx-4 shadow-xl text-center">
          <CardHeader>
            <CardTitle className="flex flex-col items-center gap-2">
              <ShieldAlert className="h-12 w-12 text-destructive" />
              Error al cargar
            </CardTitle>
            <CardDescription>
              No se pudieron cargar los datos. Verifique su conexión y permisos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} className="w-full">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Avoid flashing the access-denied card while auth is still resolving
  if (!userLoading && !user) {
    return null;
  }

  if (!user || userProfile?.role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Card className="w-full max-w-sm mx-4 shadow-xl text-center">
          <CardHeader>
            <CardTitle className="flex flex-col items-center gap-2">
              <ShieldAlert className="h-12 w-12 text-destructive" />
              Acceso Denegado
            </CardTitle>
            <CardDescription>No tiene los permisos necesarios para ver esta página.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/selection')} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Logo />
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => router.push('/selection')}>
                <Home className="mr-2 h-4 w-4" />
                Volver al menú
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-bold mb-6">Recetas y Menú</h1>

        {!selectedCompanyId ? (
          <Card>
            <CardContent className="flex items-center justify-center h-40">
              <p className="text-muted-foreground">Seleccione una empresa para continuar.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="recetas">
            <TabsList className="mb-6">
              <TabsTrigger value="recetas">
                <BookOpen className="mr-2 h-4 w-4" />
                Recetas
              </TabsTrigger>
              <TabsTrigger value="menu">
                <Calendar className="mr-2 h-4 w-4" />
                Menú Semanal
              </TabsTrigger>
              <TabsTrigger value="compras">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Lista de Compras
              </TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Recetas ─────────────────────────────────────────── */}
            <TabsContent value="recetas">
              <RecetasTab
                menuItems={menuItems ?? []}
                ingredients={ingredients ?? []}
                recipesMap={recipesMap}
                companyId={selectedCompanyId}
                firestore={firestore}
                toast={toast}
              />
            </TabsContent>

            {/* ── Tab 2: Menú Semanal ────────────────────────────────────── */}
            <TabsContent value="menu">
              <MenuSemanalTab
                menuItems={menuItems ?? []}
                weeklyMenu={weeklyMenu ?? null}
                weekStartDate={weekStartDate}
                companyId={selectedCompanyId}
                firestore={firestore}
                toast={toast}
              />
            </TabsContent>

            {/* ── Tab 3: Lista de Compras ────────────────────────────────── */}
            <TabsContent value="compras">
              <ListaComprasTab
                weeklyMenu={weeklyMenu ?? null}
                recipesMap={recipesMap}
                ingredientsMap={ingredientsMap}
                menuItems={menuItems ?? []}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

// ─── Tab 1: Recetas ────────────────────────────────────────────────────────────

interface RecetasTabProps {
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  recipesMap: Record<string, Recipe>;
  companyId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  firestore: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast: any;
}

function RecetasTab({ menuItems, ingredients, recipesMap, companyId, firestore, toast }: RecetasTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);

  const openDialog = (item: MenuItem) => {
    setSelectedMenuItem(item);
    setDialogOpen(true);
  };

  return (
    <div>
      {menuItems.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">No hay elementos de menú. Cree algunos primero.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {menuItems.map((item) => {
            const recipe = recipesMap[item.id];
            const hasRecipe = !!recipe;
            const margin =
              hasRecipe && item.price > 0
                ? ((item.price - recipe.costPerPortion) / item.price) * 100
                : null;

            return (
              <Card key={item.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{item.name}</CardTitle>
                    {hasRecipe ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200 shrink-0">
                        Receta OK
                      </Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-800 border-orange-200 shrink-0">
                        Sin receta
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.category}</p>
                  <p className="text-sm font-medium">
                    ${item.price.toFixed(2)} MXN
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 flex-1 justify-between">
                  {hasRecipe && (
                    <div className="text-sm space-y-1 bg-gray-50 dark:bg-gray-800 rounded-md p-2">
                      <p>
                        <span className="text-muted-foreground">Costo/porción: </span>
                        <span className="font-medium">${recipe.costPerPortion.toFixed(2)}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Ingredientes: </span>
                        <span className="font-medium">{recipe.ingredients.length}</span>
                      </p>
                      {margin !== null && (
                        <p>
                          <span className="text-muted-foreground">Margen: </span>
                          <span
                            className={`font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {margin.toFixed(1)}%
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant={hasRecipe ? 'outline' : 'default'}
                    className="w-full"
                    onClick={() => openDialog(item)}
                  >
                    {hasRecipe ? 'Editar Receta' : 'Crear Receta'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedMenuItem && (
        <RecipeBuilderDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          menuItem={selectedMenuItem}
          existingRecipe={recipesMap[selectedMenuItem.id] ?? null}
          ingredients={ingredients}
          companyId={companyId}
          firestore={firestore}
          toast={toast}
        />
      )}
    </div>
  );
}

// ─── Recipe Builder Dialog ─────────────────────────────────────────────────────

interface RecipeBuilderDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  menuItem: MenuItem;
  existingRecipe: Recipe | null;
  ingredients: Ingredient[];
  companyId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  firestore: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast: any;
}

let rowCounter = 0;
function newRowId() {
  return `row-${++rowCounter}`;
}

function RecipeBuilderDialog({
  open,
  onOpenChange,
  menuItem,
  existingRecipe,
  ingredients,
  companyId,
  firestore,
  toast,
}: RecipeBuilderDialogProps) {
  const [servings, setServings] = useState<number>(existingRecipe?.servings ?? 1);
  const [rows, setRows] = useState<RecipeRow[]>(() => {
    if (existingRecipe) {
      return existingRecipe.ingredients.map((ri) => ({
        id: newRowId(),
        ingredientId: ri.ingredientId,
        quantity: ri.quantity,
      }));
    }
    return [{ id: newRowId(), ingredientId: '', quantity: 1 }];
  });
  const [saving, setSaving] = useState(false);

  // Reset when dialog re-opens for a different item
  useEffect(() => {
    if (open) {
      setServings(existingRecipe?.servings ?? 1);
      setRows(
        existingRecipe
          ? existingRecipe.ingredients.map((ri) => ({
              id: newRowId(),
              ingredientId: ri.ingredientId,
              quantity: ri.quantity,
            }))
          : [{ id: newRowId(), ingredientId: '', quantity: 1 }]
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, menuItem.id]);

  const ingredientsMap = useMemo<Record<string, Ingredient>>(() => {
    return ingredients.reduce<Record<string, Ingredient>>((acc, ing) => {
      if (ing.id) acc[ing.id] = ing;
      return acc;
    }, {});
  }, [ingredients]);

  const costPerPortion = useMemo(() => {
    const totalCost = rows.reduce((sum, row) => {
      const ing = ingredientsMap[row.ingredientId];
      if (!ing) return sum;
      return sum + ing.costPerUnit * row.quantity;
    }, 0);
    return servings > 0 ? totalCost / servings : 0;
  }, [rows, servings, ingredientsMap]);

  const addRow = () => {
    setRows((prev) => [...prev, { id: newRowId(), ingredientId: '', quantity: 1 }]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, field: keyof Omit<RecipeRow, 'id'>, value: string | number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, [field]: field === 'quantity' ? Number(value) : value } : r
      )
    );
  };

  const handleSave = async () => {
    if (!firestore) return;
    const validRows = rows.filter((r) => r.ingredientId && r.quantity > 0);
    if (validRows.length === 0) {
      toast({ title: 'Agregue al menos un ingrediente válido', variant: 'destructive' });
      return;
    }

    const recipeIngredients: RecipeIngredient[] = validRows.map((r) => {
      const ing = ingredientsMap[r.ingredientId];
      return {
        ingredientId: r.ingredientId,
        ingredientName: ing?.name ?? '',
        quantity: r.quantity,
        unit: ing?.unit ?? 'pz',
      };
    });

    const recipeData: Omit<Recipe, 'id'> = {
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
      servings,
      ingredients: recipeIngredients,
      costPerPortion,
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      const recipeRef = doc(firestore, `companies/${companyId}/recipes/${menuItem.id}`);
      await setDoc(recipeRef, recipeData);
      toast({ title: 'Receta guardada correctamente' });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error al guardar la receta', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{menuItem.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Servings */}
          <div className="flex items-center gap-3">
            <Label htmlFor="servings" className="w-48 shrink-0">
              Porciones que produce
            </Label>
            <Input
              id="servings"
              type="number"
              min={1}
              value={servings}
              onChange={(e) => setServings(Math.max(1, Number(e.target.value)))}
              className="w-24"
            />
          </div>

          {/* Cost display */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-3 flex items-center justify-between">
            <span className="font-medium text-blue-800 dark:text-blue-300">
              Costo por porción calculado:
            </span>
            <span className="text-xl font-bold text-blue-900 dark:text-blue-200">
              ${costPerPortion.toFixed(2)} MXN
            </span>
          </div>

          {/* Ingredient rows */}
          <div className="space-y-2">
            <Label>Ingredientes</Label>
            {rows.map((row) => {
              const ing = ingredientsMap[row.ingredientId];
              return (
                <div key={row.id} className="flex items-center gap-2">
                  <Select
                    value={row.ingredientId}
                    onValueChange={(v) => updateRow(row.id, 'ingredientId', v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar ingrediente" />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients.map((i) => (
                        <SelectItem key={i.id} value={i.id ?? ''}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                    className="w-24"
                  />
                  <span className="w-10 text-sm text-muted-foreground shrink-0">
                    {ing?.unit ?? ''}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(row.id)}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={addRow} className="mt-1">
              <Plus className="mr-1 h-4 w-4" />
              Agregar Ingrediente
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Receta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab 2: Menú Semanal ───────────────────────────────────────────────────────

interface MenuSemanalTabProps {
  menuItems: MenuItem[];
  weeklyMenu: WeeklyMenu | null;
  weekStartDate: string;
  companyId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  firestore: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast: any;
}

function MenuSemanalTab({
  menuItems,
  weeklyMenu,
  weekStartDate,
  companyId,
  firestore,
  toast,
}: MenuSemanalTabProps) {
  const menuItemsMap = useMemo<Record<string, MenuItem>>(() => {
    return menuItems.reduce<Record<string, MenuItem>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [menuItems]);

  const getDayItems = (day: DayOfWeek): string[] => {
    return weeklyMenu?.days?.[day] ?? [];
  };

  const saveDay = async (day: DayOfWeek, newItems: string[]) => {
    if (!firestore) return;
    try {
      const menuRef = doc(firestore, `companies/${companyId}/weeklyMenus/${weekStartDate}`);
      await setDoc(
        menuRef,
        {
          weekStartDate,
          companyId,
          days: { [day]: newItems },
        },
        { merge: true }
      );
      toast({ title: `Menú del ${day} actualizado` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error al actualizar el menú', variant: 'destructive' });
    }
  };

  const addItemToDay = async (day: DayOfWeek, itemId: string) => {
    if (!itemId) return;
    const current = getDayItems(day);
    if (current.includes(itemId)) return;
    await saveDay(day, [...current, itemId]);
  };

  const removeItemFromDay = async (day: DayOfWeek, itemId: string) => {
    const current = getDayItems(day);
    await saveDay(
      day,
      current.filter((id) => id !== itemId)
    );
  };

  // Compute the date for each weekday based on weekStartDate
  const dayDates = useMemo(() => {
    const [y, m, d] = weekStartDate.split('-').map(Number);
    return DAYS_OF_WEEK.reduce<Record<DayOfWeek, string>>((acc, { key }, idx) => {
      const date = new Date(y, m - 1, d + idx);
      acc[key] = date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
      return acc;
    }, {} as Record<DayOfWeek, string>);
  }, [weekStartDate]);

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Semana del {weekStartDate}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {DAYS_OF_WEEK.map(({ key, label }) => {
          const dayItems = getDayItems(key);
          return (
            <Card key={key} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                <p className="text-xs text-muted-foreground">{dayDates[key]}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 flex-1">
                {/* Chips */}
                <div className="flex flex-wrap gap-1 min-h-[2rem]">
                  {dayItems.map((itemId) => {
                    const item = menuItemsMap[itemId];
                    return (
                      <Badge
                        key={itemId}
                        variant="secondary"
                        className="flex items-center gap-1 text-xs"
                      >
                        {item?.name ?? itemId}
                        <button
                          onClick={() => removeItemFromDay(key, itemId)}
                          className="ml-1 hover:text-destructive transition-colors"
                          aria-label="Eliminar"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>

                {/* Add select */}
                <Select onValueChange={(v) => addItemToDay(key, v)} value="">
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="+ Agregar platillo" />
                  </SelectTrigger>
                  <SelectContent>
                    {menuItems
                      .filter((item) => !dayItems.includes(item.id))
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab 3: Lista de Compras ──────────────────────────────────────────────────

interface ShoppingRow {
  ingredientId: string;
  name: string;
  unit: string;
  needed: number;
  inStock: number;
  toOrder: number;
  estimatedCost: number;
}

interface ListaComprasTabProps {
  weeklyMenu: WeeklyMenu | null;
  recipesMap: Record<string, Recipe>;
  ingredientsMap: Record<string, Ingredient>;
  menuItems: MenuItem[];
}

function ListaComprasTab({
  weeklyMenu,
  recipesMap,
  ingredientsMap,
}: ListaComprasTabProps) {
  const shoppingList = useMemo<ShoppingRow[]>(() => {
    if (!weeklyMenu) return [];
    const totals: Record<string, number> = {};

    for (const day of Object.values(weeklyMenu.days ?? {})) {
      for (const menuItemId of day) {
        const recipe = recipesMap[menuItemId];
        if (!recipe) continue;
        for (const ri of recipe.ingredients) {
          totals[ri.ingredientId] = (totals[ri.ingredientId] ?? 0) + ri.quantity;
        }
      }
    }

    return Object.entries(totals).map(([ingredientId, needed]) => {
      const ing = ingredientsMap[ingredientId];
      const inStock = ing?.currentStock ?? 0;
      const toOrder = Math.max(0, needed - inStock);
      const estimatedCost = toOrder * (ing?.costPerUnit ?? 0);
      return {
        ingredientId,
        name: ing?.name ?? ingredientId,
        unit: ing?.unit ?? '',
        needed,
        inStock,
        toOrder,
        estimatedCost,
      };
    });
  }, [weeklyMenu, recipesMap, ingredientsMap]);

  const totalCost = useMemo(
    () => shoppingList.reduce((sum, row) => sum + row.estimatedCost, 0),
    [shoppingList]
  );

  if (!weeklyMenu) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">No hay menú semanal definido. Configure el menú primero.</p>
        </CardContent>
      </Card>
    );
  }

  if (shoppingList.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">No hay ingredientes requeridos. Asocie recetas a los platillos del menú.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead className="text-right">Necesario</TableHead>
                <TableHead className="text-right">En Stock</TableHead>
                <TableHead className="text-right">A Pedir</TableHead>
                <TableHead className="text-right">Costo Estimado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shoppingList.map((row) => (
                <TableRow
                  key={row.ingredientId}
                  className={row.toOrder > 0 ? 'bg-orange-50 dark:bg-orange-900/10' : ''}
                >
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">
                    {row.needed.toFixed(2)} {row.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.inStock.toFixed(2)} {row.unit}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {row.toOrder > 0 ? (
                      <span className="text-orange-600 dark:text-orange-400">
                        {row.toOrder.toFixed(2)} {row.unit}
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">OK</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.toOrder > 0 ? `$${row.estimatedCost.toFixed(2)}` : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow className="border-t-2 font-bold">
                <TableCell colSpan={4} className="text-right">
                  Total estimado:
                </TableCell>
                <TableCell className="text-right">${totalCost.toFixed(2)} MXN</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
