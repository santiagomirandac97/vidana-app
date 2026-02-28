// Client-side only — do not import in server components or API routes.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format, eachDayOfInterval, getDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import type { Consumption, Company } from './types';

const TIME_ZONE = 'America/Mexico_City';

export interface BillingData {
  company: Company;
  consumptions: Consumption[];   // already filtered to the target month, not voided
  month: string;                 // 'yyyy-MM'
}

// ── Daily billing helper ──────────────────────────────────────────────────────

interface DailyRow {
  day: string;
  actual: number;
  billed: number;   // = MAX(actual, dailyTarget) on Mon–Thu when target > 0
  subtotal: number; // billed * mealPrice
}

/**
 * Returns one row per day that has billable meals, applying the Mon–Thu
 * dailyTarget minimum: billed = MAX(actual, dailyTarget) on Mon–Thu,
 * billed = actual on Fri–Sun.
 */
function computeDailyBilling(
  company: Company,
  consumptions: Consumption[],
  month: string
): DailyRow[] {
  const [year, monthNum] = month.split('-').map(Number);
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0); // last day of month
  const mealPrice = company.mealPrice ?? 0;
  const dailyTarget = company.dailyTarget ?? 0;

  // Bucket consumptions by Mexico City calendar date
  const countByDay: Record<string, number> = {};
  for (const c of consumptions) {
    const d = formatInTimeZone(new Date(c.timestamp), TIME_ZONE, 'yyyy-MM-dd');
    countByDay[d] = (countByDay[d] ?? 0) + 1;
  }

  return eachDayOfInterval({ start: monthStart, end: monthEnd })
    .map((date): DailyRow => {
      const dayStr = format(date, 'yyyy-MM-dd');
      const dow = getDay(date); // 0 = Sun, 1 = Mon … 4 = Thu, 5 = Fri, 6 = Sat
      const isChargeable = dow >= 1 && dow <= 4; // Mon–Thu
      const actual = countByDay[dayStr] ?? 0;
      const billed =
        dailyTarget > 0 && isChargeable ? Math.max(actual, dailyTarget) : actual;
      return { day: dayStr, actual, billed, subtotal: billed * mealPrice };
    })
    .filter((r) => r.billed > 0); // only include days with billable meals
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

  const dailyRows = computeDailyBilling(company, consumptions, month);
  const total = dailyRows.reduce((sum, r) => sum + r.subtotal, 0);

  const tableData: string[][] = dailyRows.map(({ day, actual, billed, subtotal }) => [
    day,
    actual.toString(),
    billed.toString(),
    `$${mealPrice.toFixed(2)}`,
    `$${subtotal.toFixed(2)}`,
  ]);
  tableData.push(['', '', '', 'TOTAL', `$${total.toFixed(2)}`]);

  autoTable(doc, {
    startY: company.billingNote ? 65 : 58,
    head: [['Fecha', 'Comidas Reales', 'Comidas Cobradas', 'Precio Unitario', 'Subtotal']],
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

  // Sheet 1: Resumen (daily summary with dailyTarget minimum applied)
  const dailyRows = computeDailyBilling(company, consumptions, month);
  const totalActual = dailyRows.reduce((sum, r) => sum + r.actual, 0);
  const totalBilled = dailyRows.reduce((sum, r) => sum + r.billed, 0);
  const total = dailyRows.reduce((sum, r) => sum + r.subtotal, 0);

  const summaryRows: {
    Fecha: string;
    'Comidas Reales': number;
    'Comidas Cobradas': number;
    'Precio Unitario': number;
    Subtotal: number;
  }[] = dailyRows.map(({ day, actual, billed, subtotal }) => ({
    Fecha: day,
    'Comidas Reales': actual,
    'Comidas Cobradas': billed,
    'Precio Unitario': mealPrice,
    Subtotal: subtotal,
  }));
  summaryRows.push({
    Fecha: 'TOTAL',
    'Comidas Reales': totalActual,
    'Comidas Cobradas': totalBilled,
    'Precio Unitario': mealPrice,
    Subtotal: total,
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
