/**
 * Utilitários para exportação de dados em formato ZOHO
 * Implementa o esquema de contabilização conforme "Preparar Notas Fiscais para Carga"
 */

import * as XLSX from 'xlsx';
import type { ExtractedInvoice, ZOHOInvoice } from './types';

/**
 * Tabela de mapeamento de impostos retidos
 * Baseada em "Impostos Retidos.xlsx" do script R
 */
interface TaxMapping {
  percentual: number;
  itemTax1: string;
  itemTax1Type: string;
  isInclusiveTax: string;
  itemTax1Percent: string;
}

/**
 * Mapeamento de alíquotas para configurações de imposto
 */
const TAX_MAPPINGS: Record<string, TaxMapping> = {
  '0': {
    percentual: 0,
    itemTax1: 'ISS',
    itemTax1Type: 'Tax',
    isInclusiveTax: 'false',
    itemTax1Percent: '0.00%',
  },
  '2': {
    percentual: 2,
    itemTax1: 'ISS',
    itemTax1Type: 'Tax',
    isInclusiveTax: 'false',
    itemTax1Percent: '2.00%',
  },
  '3': {
    percentual: 3,
    itemTax1: 'ISS',
    itemTax1Type: 'Tax',
    isInclusiveTax: 'false',
    itemTax1Percent: '3.00%',
  },
  '5': {
    percentual: 5,
    itemTax1: 'ISS',
    itemTax1Type: 'Tax',
    isInclusiveTax: 'false',
    itemTax1Percent: '5.00%',
  },
};

/**
 * Calcula a alíquota efetiva de impostos
 * Baseado em: (Valor Bruto - Valor Líquido) * 100 / Valor Bruto
 */
function calculateEffectiveTaxRate(invoice: ExtractedInvoice): number {
  if (invoice.serviceValue === 0) return 0;
  return ((invoice.serviceValue - invoice.netValue) * 100) / invoice.serviceValue;
}

/**
 * Encontra o mapeamento de imposto mais próximo
 */
function findTaxMapping(effectiveRate: number): TaxMapping {
  const rates = Object.keys(TAX_MAPPINGS).map(Number);
  const closest = rates.reduce((prev, curr) =>
    Math.abs(curr - effectiveRate) < Math.abs(prev - effectiveRate) ? curr : prev
  );
  return TAX_MAPPINGS[closest.toString()] || TAX_MAPPINGS['0'];
}

/**
 * Converte ExtractedInvoice para formato ZOHO
 */
export function convertToZOHO(invoice: ExtractedInvoice): ZOHOInvoice {
  const effectiveTaxRate = calculateEffectiveTaxRate(invoice);
  const taxMapping = findTaxMapping(effectiveTaxRate);

  // Calcular total retido (soma de todos os impostos)
  const totalRetido =
    invoice.irrf + invoice.pis + invoice.cofins + invoice.csll + invoice.issqnRetido;

  // Converter centavos para reais
  const itemPrice = invoice.serviceValue / 100;
  const adjustment = -(totalRetido / 100);

  return {
    'Invoice Date': formatDate(invoice.emissionDate),
    'Invoice Number': invoice.nfsNumber,
    'Invoice Status': 'draft',
    'Customer Name': invoice.takerName,
    'Template Name': 'Classic',
    'Currency Code': 'BRL',
    'Exchange Rate': 1,
    'SKU': '',
    'Item Desc': invoice.serviceDescription,
    'Quantity': 1,
    'Item Price': itemPrice,
    'Adjustment': adjustment,
    'Adjustment Description': 'Impostos',
    'Usage unit': 1,
    'Discount': 0,
    'Is Inclusive Tax': taxMapping.isInclusiveTax,
    'Item Tax1': taxMapping.itemTax1,
    'Item Tax1 Type': taxMapping.itemTax1Type,
    'Item Tax1 %': taxMapping.itemTax1Percent,
    'Project Name': '',
    'Account': 'Vendas',
    'Notes': `NFS-e ${invoice.nfsNumber} - Emitente: ${invoice.issuerName} (${invoice.issuerCNPJ})`,
    'Terms & Conditions': '',
  };
}

/**
 * Formata data de DD/MM/YYYY para DD/MM/YYYY
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  // Se já está em DD/MM/YYYY, retorna como está
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  // Tenta converter de outros formatos
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Exporta invoices para formato ZOHO em Excel
 */
export function exportToZOHOExcel(invoices: ExtractedInvoice[]): void {
  const zohoData = invoices.map((invoice) => convertToZOHO(invoice));

  const worksheet = XLSX.utils.json_to_sheet(zohoData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Notas Fiscais');

  // Ajustar largura das colunas
  const colWidths = Object.keys(zohoData[0] || {}).map(() => 25);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (worksheet as any)['!cols'] = colWidths.map((width) => ({ wch: width }));

  const filename = `ZOHO-Carga-Faturas-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Exporta invoices para formato ZOHO em CSV
 */
export function exportToZOHOCSV(invoices: ExtractedInvoice[]): string {
  const zohoData = invoices.map((invoice) => convertToZOHO(invoice));

  if (zohoData.length === 0) {
    return '';
  }

  const headers = Object.keys(zohoData[0]);

  const rows = zohoData.map((row) =>
    headers.map((header) => {
      const value = row[header as keyof ZOHOInvoice];
      const cellStr = String(value || '');
      return `"${cellStr.replace(/"/g, '""')}"`;
    })
  );

  const csvContent = [
    headers.map((h) => `"${h}"`).join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Gera relatório de validação para exportação ZOHO
 */
export function generateZOHOValidationReport(invoices: ExtractedInvoice[]): {
  totalInvoices: number;
  validInvoices: number;
  invalidInvoices: number;
  issues: Array<{ nfsNumber: string; issue: string }>;
} {
  const issues: Array<{ nfsNumber: string; issue: string }> = [];

  invoices.forEach((invoice) => {
    if (!invoice.nfsNumber) {
      issues.push({ nfsNumber: 'N/A', issue: 'Número NFS-e não extraído' });
    }
    if (!invoice.takerName) {
      issues.push({ nfsNumber: invoice.nfsNumber, issue: 'Nome do tomador não extraído' });
    }
    if (invoice.serviceValue === 0) {
      issues.push({ nfsNumber: invoice.nfsNumber, issue: 'Valor do serviço é zero' });
    }
    if (invoice.extractionErrors && invoice.extractionErrors.length > 0) {
      issues.push({
        nfsNumber: invoice.nfsNumber,
        issue: `Erros na extração: ${invoice.extractionErrors.join('; ')}`,
      });
    }
  });

  return {
    totalInvoices: invoices.length,
    validInvoices: invoices.length - issues.length,
    invalidInvoices: issues.length,
    issues,
  };
}
