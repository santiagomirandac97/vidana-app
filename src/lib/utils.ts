import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatInTimeZone } from 'date-fns-tz';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return formatInTimeZone(date, 'America/Mexico_City', 'pp');
}

export function getTodayInMexicoCity(): string {
    return formatInTimeZone(new Date(), 'America/Mexico_City', 'yyyy-MM-dd');
}

export function exportToCsv(filename: string, rows: (string | number | boolean)[][]) {
  if (!rows || rows.length === 0) {
    alert("No data to export.");
    return;
  }

  const processRow = (row: (string | number | boolean)[]) => row.map(val => {
      const strVal = String(val ?? '').replace(/"/g, '""');
      if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal}"`;
      }
      return strVal;
  }).join(',');

  // Add BOM for UTF-8 compatibility in Excel
  const BOM = "\uFEFF";
  const csvContent = BOM + rows.map(processRow).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
