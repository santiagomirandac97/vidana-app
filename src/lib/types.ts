

export type Company = {
  id: string;
  name: string;
  accessCode?: string;
  mealPrice?: number;
  dailyTarget?: number;
  billingNote?: string;
};

export interface Employee {
  id?: string;
  employeeNumber: string;
  name: string;
  companyId: string;
  department?: string;
  email?: string;
  active: boolean;
  paymentAmount?: number;
  voided?: boolean;
}

export interface OrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Consumption {
  id?: string;
  employeeId: string;
  employeeNumber: string;
  name: string;
  companyId: string;
  timestamp: string; // ISO-8601
  voided: boolean;
  items?: OrderItem[];
  totalAmount?: number;
  status?: 'pending' | 'completed';
}

export interface UserProfile {
    uid: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
}

export interface AppConfiguration {
    id?: string;
    allowedDomains: string[];
}

export interface MenuItem {
    id: string;
    sku?: string;
    name: string;
    price: number;
    category: string;
    companyId: string;
}


// ─── Inventory ────────────────────────────────────────────────────────────────

export type StockUnit = 'kg' | 'L' | 'pz' | 'g' | 'ml';
export type MovementType = 'entrada' | 'salida' | 'ajuste' | 'merma';
export type PurchaseOrderStatus = 'borrador' | 'enviado' | 'recibido';

export interface Ingredient {
  id?: string;
  name: string;
  unit: StockUnit;
  currentStock: number;
  minStock: number;
  category: string;
  costPerUnit: number; // MXN per unit
  supplierId?: string;
  active: boolean;
}

export interface StockMovement {
  id?: string;
  ingredientId: string;
  ingredientName: string; // denormalized for display
  type: MovementType;
  quantity: number; // always positive
  reason?: string;
  purchaseOrderId?: string;
  createdBy: string; // user uid
  timestamp: string; // ISO-8601
  unitCost: number; // cost at time of movement
}

export interface Supplier {
  id?: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  active: boolean;
}

export interface PurchaseOrderItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unitCost: number;
  received: boolean;
}

export interface PurchaseOrder {
  id?: string;
  supplierId: string;
  supplierName: string; // denormalized
  items: PurchaseOrderItem[];
  status: PurchaseOrderStatus;
  totalCost: number;
  createdAt: string; // ISO-8601
  receivedAt?: string; // ISO-8601
  createdBy: string;
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string; // denormalized
  quantity: number;
  unit: StockUnit;
}

export interface Recipe {
  id?: string;
  menuItemId: string;
  menuItemName: string; // denormalized
  servings: number;
  ingredients: RecipeIngredient[];
  costPerPortion: number; // auto-calculated
  updatedAt: string; // ISO-8601
}

export type DayOfWeek = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';

export interface WeeklyMenu {
  id?: string;
  weekStartDate: string; // 'yyyy-MM-dd' — Monday
  companyId: string;
  days: Record<DayOfWeek, string[]>; // menuItemId[]
}

// ─── Costs ────────────────────────────────────────────────────────────────────

export interface LaborCost {
  id?: string;
  weekStartDate: string; // 'yyyy-MM-dd' — Monday
  amount: number; // MXN
  notes?: string;
  createdBy: string;
}
