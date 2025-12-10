

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
  voided: boolean;
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
