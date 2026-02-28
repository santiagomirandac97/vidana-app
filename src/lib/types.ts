

export type Company = {
  id: string;
  name: string;
  accessCode?: string;
  mealPrice?: number;
  dailyTarget?: number;
  targetDays?: number[];        // day-of-week indices when dailyTarget applies (0=Sun … 6=Sat). Default [1,2,3,4] = Mon–Thu.
  billingNote?: string;
  // Predictive restocking
  stockLookbackDays?: number;   // default 30 — how many days of movements to analyse
  restockLeadDays?: number;     // default 7  — pre-fill PO for anything running out within N days
  // AI planning
  targetFoodCostPct?: number;   // default 35 — food cost % ceiling for AI menu suggestion
  // Billing
  billingEmail?: string;        // invoice recipient email
  billingStatus?: Record<string, 'pendiente' | 'enviado' | 'pagado'>; // key = 'yyyy-MM'
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
    companyId?: string;
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
  companyId?: string; // denormalized for collectionGroup queries
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
  companyId?: string; // denormalized for collectionGroup queries
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

// ─── Invites ──────────────────────────────────────────────────────────────────

export interface UserInvite {
  id?: string;
  companyId: string;
  role: 'admin' | 'user';
  createdBy: string;       // admin uid
  createdAt: string;       // ISO-8601
  expiresAt: string;       // ISO-8601 (+7 days from createdAt)
  email?: string;          // optional — pre-fill hint only
  used: boolean;
}

// ─── Costs ────────────────────────────────────────────────────────────────────

export interface LaborCost {
  id?: string;
  companyId: string;
  weekStartDate: string; // 'yyyy-MM-dd' — Monday
  amount: number; // MXN
  notes?: string;
  createdBy: string;
}
