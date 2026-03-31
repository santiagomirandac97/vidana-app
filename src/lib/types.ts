
export type OperatingHour = {
  day: number;    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  open: string;   // "08:00" (24h format)
  close: string;  // "17:30" (24h format)
};

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
  targetFoodCostPct?: number;        // default 35 — food cost % ceiling for AI menu suggestion
  estimatedFoodCostPerMeal?: number; // MXN per meal — fallback when purchase orders aren't used
  // Billing
  billingEmail?: string;        // invoice recipient email
  billingStatus?: Record<string, 'pendiente' | 'enviado' | 'pagado'>; // key = 'yyyy-MM'
  requiresEmployeeSelection?: boolean;  // true = Televisa mode
  allowedCustomerDomains?: string[];
  paymentMethods?: ('nomina' | 'efectivo' | 'tarjeta' | 'transferencia')[];
  takeAwayEnabled?: boolean;
  orderPortalEnabled?: boolean;
  operatingHours?: OperatingHour[];
  estimatedPrepTime?: string;
  termsUrl?: string;
  privacyUrl?: string;
};

export interface RfidDevice {
  id?: string;
  name: string;                    // e.g., "IDEMIA Comedor Principal"
  ipAddress: string;               // public IP or hostname, e.g., "203.0.113.10"
  port?: number;                   // device HTTP port (default 80)
  type: 'idemia-morphoaccess';     // extensible for future device types
  companyId: string;
  active: boolean;
  lastSeen?: string;               // ISO timestamp of last successful poll
  username?: string;               // device admin username
  password?: string;               // device admin password (encrypted in production)
  pollIntervalMs?: number;         // polling interval (default 2000)
}

/** A single RFID tap event written by the Cloud Run poller */
export interface RfidTap {
  id?: string;
  deviceId: string;
  companyId: string;
  cardNumber: string;              // card UID from the IDEMIA reader
  timestamp: string;               // ISO-8601 when the tap occurred on the device
  processedAt?: string;            // ISO-8601 when the app processed this tap
  status: 'pending' | 'registered' | 'already-eaten' | 'unknown-card';
  employeeId?: string;             // matched employee ID (if found)
  employeeName?: string;           // matched employee name (for display)
  consumptionId?: string;          // created consumption ID (if registered)
}

export interface Employee {
  id?: string;
  employeeNumber: string;
  name: string;
  companyId: string;
  position?: string;           // job title e.g. "Cocinero", "Cajero"
  department?: string;
  email?: string;
  active: boolean;
  salaryPerQuincena?: number;  // fixed bi-weekly salary MXN
  paymentAmount?: number;      // kept for backwards compat
  voided?: boolean;
  startDate?: string;          // yyyy-MM-dd — set on creation
  endDate?: string;            // yyyy-MM-dd — set on deactivation
  cardNumber?: string;         // RFID card UID (e.g., MIFARE DESFire)
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
  orderNumber?: number;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'nomina' | 'efectivo' | 'tarjeta' | 'transferencia';
  customerNote?: string;
  completedAt?: string; // ISO-8601 — set when kitchen marks the order complete
  orderType?: 'eat_in' | 'take_away';
  scheduledFor?: string;
  selectedModifiers?: Record<string, string[]>;
  specialInstructions?: Record<string, string>;
  source?: 'pos' | 'portal';
  customerEmail?: string;
}

export interface UserProfile {
    uid: string;
    name: string;
    email: string;
    role: 'admin' | 'operations' | 'user' | 'customer';
    companyId?: string;
    photoURL?: string;
    phone?: string;
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
    description?: string;
    imageUrl?: string;
    modifiers?: MenuItemModifier[];
    modifierGroupMeta?: Record<string, ModifierGroupMeta>; // keyed by group name
    available?: boolean;
}

export interface MenuItemModifier {
  id: string;
  name: string;
  group: string;
  priceAdjustment: number;
}

export interface ModifierGroupMeta {
  maxSelections?: number; // max items selectable in this group; undefined = no limit
}

export interface MenuSchedule {
  id?: string;
  companyId: string;
  menuItemIds: string[];
  name: string;
  active: boolean;
  timeRestriction?: {
    startTime: string; // "HH:mm"
    endTime: string;   // "HH:mm"
  };
  daysOfWeek?: number[]; // 0-6 (Sun-Sat), undefined = every day
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
  companyId: string; // denormalized — required for collectionGroup queries in costos
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
  role: 'admin' | 'operations' | 'user' | 'customer';
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

// ─── Payroll ─────────────────────────────────────────────────────────────────

export interface Bonus {
  id?: string;
  employeeId: string;
  companyId: string;
  description: string;        // e.g. "Bono puntualidad"
  amount: number;             // MXN
  isRecurring: boolean;       // true = every quincena
  appliesTo?: string;         // 'yyyy-MM-dd' — only for one-time bonuses
  active: boolean;
  createdBy: string;
}

// ─── Operational Costs ──────────────────────────────────────────────────────

export type OperationalCostCategory =
  | 'renta'
  | 'mantenimiento'
  | 'desechables'
  | 'capacitacion'
  | 'seguros'
  | 'servicios'
  | 'otro';

export interface OperationalCost {
  id?: string;
  category: OperationalCostCategory;
  description: string;        // custom note
  amount: number;             // MXN
  month: string;              // 'yyyy-MM' format
  companyId: string;          // denormalized for collectionGroup
  createdAt: string;          // ISO-8601
  createdBy: string;          // uid
}

// ─── Surveys ─────────────────────────────────────────────────────────────────

export type SurveyQuestionType = 'star' | 'emoji' | 'text' | 'multiple_choice' | 'multi_select' | 'nps';

export interface SurveyQuestion {
  id: string;       // stable slug — used as key in answers Record (e.g. 'food_quality')
  text: string;     // question label shown to respondent
  type: SurveyQuestionType;
  required: boolean;
  options?: string[];    // choices for multiple_choice and multi_select
  maxSelections?: number; // for multi_select — max items user can pick
}

export interface Survey {
  id?: string;
  name: string;           // "Satisfacción Enero 2026"
  companyId: string;      // ties to existing Company doc
  status: 'active' | 'closed';
  questions: SurveyQuestion[];  // ordered, no limit
  createdAt: string;      // ISO-8601
  createdBy: string;      // admin uid
}

export interface SurveyResponse {
  id?: string;
  surveyId: string;
  companyId: string;                        // denormalized
  submittedAt: string;                      // ISO-8601
  answers: Record<string, number | string | string[]>; // questionId → 1–5 for ratings, string for text/mc, string[] for multi_select, number 0–10 for nps
}
