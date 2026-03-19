// Client-side only — do not import in server components or API routes.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface CostosExportData {
  monthLabel: string;          // "Marzo 2026"
  kpis: {
    revenue: number;
    foodCost: number;
    laborCost: number;
    wasteCost: number;
    opCost: number;
    netMargin: number;
    foodCostPct: number;
    mealsServed: number;
    costPerMeal: number;
  };
  perKitchen: Array<{
    name: string;
    meals: number;
    revenue: number;
    food: number;
    labor: number;
    waste: number;
    opCost: number;
    margin: number;
    marginPct: number;
  }>;
  purchaseOrders: Array<{
    date: string;
    supplier: string;
    total: number;
    company: string;
  }>;
  wasteEntries: Array<{
    date: string;
    ingredient: string;
    quantity: number;
    unitCost: number;
    total: number;
    reason: string;
    company: string;
  }>;
  operationalCosts: Array<{
    category: string;
    description: string;
    amount: number;
    company: string;
  }>;
}

const fmtCurrency = (n: number) => `$${n.toFixed(2)}`;
const VIDANA_BLUE: [number, number, number] = [37, 99, 235];

// ── PDF ───────────────────────────────────────────────────────────────────────

export function generateCostosPDF(data: CostosExportData): Blob {
  const doc = new jsPDF();
  const { monthLabel, kpis, perKitchen } = data;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE DE COSTOS \u2014 Vidana', 105, 20, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Per\u00edodo: ${monthLabel}`, 20, 32);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, 20, 38);

  // Summary section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen', 20, 50);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryLines = [
    ['Ingresos', fmtCurrency(kpis.revenue)],
    ['Costo Alimentos', fmtCurrency(kpis.foodCost)],
    ['Costo Laboral', fmtCurrency(kpis.laborCost)],
    ['Merma', fmtCurrency(kpis.wasteCost)],
    ['Gastos Operativos', fmtCurrency(kpis.opCost)],
    ['Margen Neto', fmtCurrency(kpis.netMargin)],
    ['Comidas Servidas', kpis.mealsServed.toLocaleString()],
    ['Costo por Comida', fmtCurrency(kpis.costPerMeal)],
  ];

  let y = 56;
  for (const [label, value] of summaryLines) {
    doc.text(`${label}:`, 24, y);
    doc.text(value, 90, y);
    y += 6;
  }

  // Food cost % — highlight if over 35%
  const foodPctText = `% Costo Alimentos: ${kpis.foodCostPct.toFixed(1)}%`;
  y += 2;
  if (kpis.foodCostPct > 35) {
    doc.setTextColor(220, 38, 38); // red
  } else {
    doc.setTextColor(22, 163, 74); // green
  }
  doc.setFont('helvetica', 'bold');
  doc.text(foodPctText, 24, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  // Per-kitchen table
  y += 12;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Desglose por Cocina', 20, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Cocina', 'Comidas', 'Ingresos', 'Alimentos', 'Labor', 'Merma', 'Gastos Op.', 'Margen', 'Margen %']],
    body: perKitchen.map(k => [
      k.name,
      k.meals.toString(),
      fmtCurrency(k.revenue),
      fmtCurrency(k.food),
      fmtCurrency(k.labor),
      fmtCurrency(k.waste),
      fmtCurrency(k.opCost),
      fmtCurrency(k.margin),
      `${k.marginPct.toFixed(1)}%`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: VIDANA_BLUE },
  });

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Generado por Vidana Hub', 105, pageHeight - 10, { align: 'center' });

  return doc.output('blob');
}

// ── Excel ─────────────────────────────────────────────────────────────────────

export function generateCostosExcel(data: CostosExportData): Blob {
  const { monthLabel, kpis, perKitchen, purchaseOrders, wasteEntries, operationalCosts } = data;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const resumenRows = [
    { M\u00e9trica: 'Per\u00edodo', Valor: monthLabel },
    { M\u00e9trica: 'Ingresos', Valor: kpis.revenue },
    { M\u00e9trica: 'Costo Alimentos', Valor: kpis.foodCost },
    { M\u00e9trica: '% Costo Alimentos', Valor: `${kpis.foodCostPct.toFixed(1)}%` },
    { M\u00e9trica: 'Costo Laboral', Valor: kpis.laborCost },
    { M\u00e9trica: 'Merma', Valor: kpis.wasteCost },
    { M\u00e9trica: 'Gastos Operativos', Valor: kpis.opCost },
    { M\u00e9trica: 'Margen Neto', Valor: kpis.netMargin },
    { M\u00e9trica: 'Comidas Servidas', Valor: kpis.mealsServed },
    { M\u00e9trica: 'Costo por Comida', Valor: kpis.costPerMeal },
  ];
  const ws1 = XLSX.utils.json_to_sheet(resumenRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // Sheet 2: Por Cocina
  const porCocinaRows = perKitchen.map(k => ({
    Cocina: k.name,
    Comidas: k.meals,
    Ingresos: k.revenue,
    Alimentos: k.food,
    Labor: k.labor,
    Merma: k.waste,
    'Gastos Op.': k.opCost,
    Margen: k.margin,
    'Margen %': `${k.marginPct.toFixed(1)}%`,
  }));
  const ws2 = XLSX.utils.json_to_sheet(porCocinaRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Por Cocina');

  // Sheet 3: Ordenes de Compra
  const poRows = purchaseOrders.map(po => ({
    Fecha: po.date,
    Proveedor: po.supplier,
    Total: po.total,
    Empresa: po.company,
  }));
  const ws3 = XLSX.utils.json_to_sheet(poRows.length > 0 ? poRows : [{ Fecha: '', Proveedor: '', Total: '', Empresa: '' }]);
  XLSX.utils.book_append_sheet(wb, ws3, '\u00d3rdenes de Compra');

  // Sheet 4: Merma
  const mermaRows = wasteEntries.map(w => ({
    Fecha: w.date,
    Ingrediente: w.ingredient,
    Cantidad: w.quantity,
    'Costo Unitario': w.unitCost,
    'Costo Total': w.total,
    Raz\u00f3n: w.reason,
    Empresa: w.company,
  }));
  const ws4 = XLSX.utils.json_to_sheet(mermaRows.length > 0 ? mermaRows : [{ Fecha: '', Ingrediente: '', Cantidad: '', 'Costo Unitario': '', 'Costo Total': '', Raz\u00f3n: '', Empresa: '' }]);
  XLSX.utils.book_append_sheet(wb, ws4, 'Merma');

  // Sheet 5: Gastos Operativos
  const opRows = operationalCosts.map(oc => ({
    Categor\u00eda: oc.category,
    Descripci\u00f3n: oc.description,
    Monto: oc.amount,
    Empresa: oc.company,
  }));
  const ws5 = XLSX.utils.json_to_sheet(opRows.length > 0 ? opRows : [{ Categor\u00eda: '', Descripci\u00f3n: '', Monto: '', Empresa: '' }]);
  XLSX.utils.book_append_sheet(wb, ws5, 'Gastos Operativos');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
