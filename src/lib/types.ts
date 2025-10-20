
export type Company = {
  id: "Inditex" | "Grupo Axo";
  name: string;
  accessCode: string;
};

export const COMPANIES: Company[] = [
    { id: 'Inditex', name: 'Inditex', accessCode: 'IND123' },
    { id: 'Grupo Axo', name: 'Grupo Axo', accessCode: 'AXO456' },
];

export interface Employee {
  id?: string;
  employeeNumber: string;
  name: string;
  companyId: string;
  department?: string;
  email?: string;
  active: boolean;
  paymentAmount?: number;
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
