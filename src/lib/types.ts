export type Company = "Inditex" | "Grupo Axo";

export const COMPANIES: Company[] = ["Inditex", "Grupo Axo"];

export interface Employee {
  employee_number: string;
  name: string;
  company: Company;
  department?: string;
  email?: string;
  active: boolean;
}

export type EmployeesData = {
  [key in Company]: Employee[];
};

export interface Consumption {
  id: string; // uuid
  employee_number: string;
  name: string;
  company: Company;
  timestamp: string; // ISO-8601
  voided: boolean;
}

export type ConsumptionsData = {
  [key in Company]: Consumption[];
};
