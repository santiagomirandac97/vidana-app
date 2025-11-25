
export type Company = {
  id: string;
  name: string;
  accessCode: string;
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

export interface Consumption {
  id?: string;
  employeeId: string;
  employeeNumber: string;
  name: string;
  companyId: string;
  timestamp: string; // ISO-8601
  voided: boolean;
}
