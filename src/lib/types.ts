export type Company = {
  id: "Inditex" | "Grupo Axo";
  name: string;
};

export const COMPANIES: Company[] = [
    { id: 'Inditex', name: 'Inditex' },
    { id: 'Grupo Axo', name: 'Grupo Axo' },
];

export interface Employee {
  id?: string;
  employeeNumber: string;
  name: string;
  companyId: string;
  department?: string;
  email?: string;
  active: boolean;
}

export interface Consumption {
  id?: string;
  employeeId: string;
  employeeNumber: string;
  name: string;
  companyId: string;
  timestamp: string; // ISO-8601
  voided: boolean;
}
