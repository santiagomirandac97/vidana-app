import { z } from 'zod';
import type { StockUnit, MovementType } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const TIME_ZONE = 'America/Mexico_City';

export const STOCK_UNITS: StockUnit[] = ['kg', 'L', 'pz', 'g', 'ml'];
export const MOVEMENT_TYPES: MovementType[] = ['entrada', 'salida', 'ajuste', 'merma'];

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const ingredientSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  unit: z.enum(['kg', 'L', 'pz', 'g', 'ml'] as const),
  currentStock: z.coerce.number().min(0, 'El stock no puede ser negativo'),
  minStock: z.coerce.number().min(0, 'El stock mínimo no puede ser negativo'),
  category: z.string().min(1, 'La categoría es requerida'),
  costPerUnit: z.coerce.number().min(0, 'El costo no puede ser negativo'),
  supplierId: z.string().optional(),
});

export type IngredientFormValues = z.infer<typeof ingredientSchema>;

export const movementSchema = z.object({
  type: z.enum(['entrada', 'salida', 'ajuste', 'merma'] as const),
  quantity: z.coerce.number().min(0.001, 'La cantidad debe ser mayor a 0'),
  reason: z.string().optional(),
});

export type MovementFormValues = z.infer<typeof movementSchema>;

export const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

export const purchaseOrderItemSchema = z.object({
  ingredientId: z.string().min(1, 'Seleccione un ingrediente'),
  ingredientName: z.string(),
  quantity: z.coerce.number().min(0.001, 'La cantidad debe ser mayor a 0'),
  unitCost: z.coerce.number().min(0, 'El costo no puede ser negativo'),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Seleccione un proveedor'),
  supplierName: z.string(),
  items: z.array(purchaseOrderItemSchema).min(1, 'Agregue al menos un artículo'),
});

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
