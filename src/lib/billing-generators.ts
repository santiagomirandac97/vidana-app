// Client-side only — do not import in server components or API routes.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Consumption, Company } from './types';

export interface BillingData {
  company: Company;
  consumptions: Consumption[];   // already filtered to the target month, not voided
  month: string;                 // 'yyyy-MM'
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export function generateInvoicePDF(data: BillingData): Blob {
  const doc = new jsPDF();
  const { company, consumptions, month } = data;
  const [year, monthNum] = month.split('-');
  const monthLabel = format(
    new Date(parseInt(year), parseInt(monthNum) - 1, 1),
    'MMMM yyyy',
    { locale: es }
  );
  const mealPrice = company.mealPrice ?? 0;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DE CUENTA', 105, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Empresa: ${company.name}`, 20, 35);
  doc.text(`Período: ${monthLabel}`, 20, 42);
  doc.text(`Fecha de emisión: ${format(new Date(), 'dd/MM/yyyy')}`, 20, 49);
  if (company.billingNote) {
    doc.setFontSize(10);
    doc.text(`Nota: ${company.billingNote}`, 20, 56);
  }

  // Group consumptions by day
  const byDay: Record<string, Consumption[]> = {};
  for (const c of consumptions) {
    const day = c.timestamp.slice(0, 10); // 'yyyy-MM-dd'
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(c);
  }
  const sortedDays = Object.keys(byDay).sort();

  const tableData: string[][] = sortedDays.map((day) => {
    const count = byDay[day].length;
    const subtotal = count * mealPrice;
    return [day, count.toString(), `$${mealPrice.toFixed(2)}`, `$${subtotal.toFixed(2)}`];
  });
  const total = consumptions.length * mealPrice;
  tableData.push(['', '', 'TOTAL', `$${total.toFixed(2)}`]);

  autoTable(doc, {
    startY: company.billingNote ? 65 : 58,
    head: [['Fecha', 'Comidas Servidas', 'Precio Unitario', 'Subtotal']],
    body: tableData,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  return doc.output('blob');
}

// ── Excel ─────────────────────────────────────────────────────────────────────

export function generateInvoiceExcel(data: BillingData): Blob {
  const { company, consumptions, month } = data;
  const mealPrice = company.mealPrice ?? 0;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen (daily summary)
  const byDay: Record<string, number> = {};
  for (const c of consumptions) {
    const day = c.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }
  const summaryRows = Object.keys(byDay)
    .sort()
    .map((day) => ({
      Fecha: day,
      'Comidas Servidas': byDay[day],
      'Precio Unitario': mealPrice,
      Subtotal: byDay[day] * mealPrice,
    }));
  summaryRows.push({
    Fecha: 'TOTAL',
    'Comidas Servidas': consumptions.length,
    'Precio Unitario': mealPrice,
    Subtotal: consumptions.length * mealPrice,
  });

  const ws1 = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // Sheet 2: Detalle (one row per consumption)
  const detailRows = consumptions.map((c) => ({
    'No. Empleado': c.employeeNumber,
    Nombre: c.name,
    Timestamp: c.timestamp,
    Empresa: company.name,
    'Precio Unitario': mealPrice,
  }));
  const ws2 = XLSX.utils.json_to_sheet(detailRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalle');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convert a Blob to a base64 string (for email attachment payload). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]); // strip "data:...;base64," prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
