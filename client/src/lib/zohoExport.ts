/**
 * Utilitários para exportação de dados em formato ZOHO
 * Implementa o esquema de contabilização conforme "Preparar Notas Fiscais para Carga"
 * 
 * Matching:
 * 1. Impostos: Percentual total de retenção = (IRRF + CSLL + COFINS + PIS + ISS) / Valor Serviço
 * 2. Cliente: Nome do tomador (DE) → Nome normalizado (PARA)
 * 3. Alocação: Cliente (PARA) → Equipe e Projeto
 */

import * as XLSX from 'xlsx';
import type { ExtractedInvoice, ZOHOInvoice, ExcelReferenceData } from './types';

/**
 * Interface para dados de impostos retidos
 */
interface TaxMapping {
  percentual: number;
  itemTax1: string;
  itemTax1Type: string;
  isInclusiveTax: string;
  itemTax1Percent: string;
  irpj: number;
  csll: number;
  cofins: number;
  pis: number;
  iss: number;
}

/**
 * Interface para dados de cliente (de-para)
 */
interface ClientMapping {
  de: string; // Nome original do cliente
  para: string; // Nome normalizado
  account: string; // Conta contábil
}

/**
 * Interface para dados de alocação
 */
interface AllocationData {
  cliente: string; // Nome normalizado
  equipe: string;
  projeto: string;
}

/**
 * Extrai dados de impostos da primeira aba do Excel
 */
export function extractTaxMappings(data: ExcelReferenceData[]): TaxMapping[] {
  return data.map((row) => {
    const percentual = parseFloat(String(row['Item Tax1 %'] || 0));
    return {
      percentual,
      itemTax1: String(row['Item Tax1'] || ''),
      itemTax1Type: String(row['Item Tax1 Type'] || 'Tax'),
      isInclusiveTax: String(row['Is Inclusive Tax'] || 'false'),
      itemTax1Percent: String(row['Item Tax1 %2'] || '0%'),
      irpj: parseFloat(String(row['IRPJ'] || 0)),
      csll: parseFloat(String(row['CSLL'] || 0)),
      cofins: parseFloat(String(row['COFINS'] || 0)),
      pis: parseFloat(String(row['PIS'] || 0)),
      iss: parseFloat(String(row['ISS'] || 0)),
    };
  });
}

/**
 * Extrai dados de cliente (de-para) da segunda aba do Excel
 */
export function extractClientMappings(data: ExcelReferenceData[]): ClientMapping[] {
  return data.map((row) => ({
    de: String(row['DE'] || '').trim().toUpperCase(),
    para: String(row['PARA'] || '').trim(),
    account: String(row['Account'] || 'Vendas'),
  }));
}

/**
 * Extrai dados de alocação da terceira aba do Excel
 */
export function extractAllocationData(data: ExcelReferenceData[]): AllocationData[] {
  return data.map((row) => ({
    cliente: String(row['Cliente'] || '').trim(),
    equipe: String(row['Equipe'] || ''),
    projeto: String(row['Projeto'] || ''),
  }));
}

/**
 * Calcula o percentual total de retenção
 * Baseado em: (IRRF + CSLL + COFINS + PIS + ISS) * 100 / Valor Serviço
 */
function calculateTotalRetentionPercentage(invoice: ExtractedInvoice): number {
  if (invoice.serviceValue === 0) return 0;
  const totalRetained = invoice.irrf + invoice.pis + invoice.cofins + invoice.csll + invoice.issqnRetido;
  return (totalRetained * 100) / invoice.serviceValue;
}

/**
 * Encontra o mapeamento de imposto mais próximo pelo percentual
 */
function findTaxMapping(
  retentionPercentage: number,
  taxMappings: TaxMapping[]
): TaxMapping {
  if (taxMappings.length === 0) {
    return {
      percentual: 0,
      itemTax1: 'ISS',
      itemTax1Type: 'Tax',
      isInclusiveTax: 'false',
      itemTax1Percent: '0.00%',
      irpj: 0,
      csll: 0,
      cofins: 0,
      pis: 0,
      iss: 0,
    };
  }

  // Encontra o mapeamento com percentual mais próximo
  return taxMappings.reduce((prev, curr) =>
    Math.abs(curr.percentual - retentionPercentage) <
    Math.abs(prev.percentual - retentionPercentage)
      ? curr
      : prev
  );
}

/**
 * Encontra o cliente normalizado pelo nome original
 */
function findClientMapping(
  originalName: string,
  clientMappings: ClientMapping[]
): ClientMapping | null {
  const normalized = originalName.trim().toUpperCase();
  return clientMappings.find((m) => m.de === normalized) || null;
}

/**
 * Encontra dados de alocação pelo cliente normalizado
 */
function findAllocationData(
  clientName: string,
  allocationData: AllocationData[]
): AllocationData | null {
  return allocationData.find((a) => a.cliente === clientName) || null;
}

/**
 * Converte ExtractedInvoice para formato ZOHO com matching
 */
export function convertToZOHO(
  invoice: ExtractedInvoice,
  taxMappings: TaxMapping[] = [],
  clientMappings: ClientMapping[] = [],
  allocationData: AllocationData[] = []
): ZOHOInvoice {
  // Calcular percentual de retenção
  const retentionPercentage = calculateTotalRetentionPercentage(invoice);
  const taxMapping = findTaxMapping(retentionPercentage, taxMappings);

  // Encontrar cliente normalizado
  let normalizedClientName = invoice.takerName;
  let account = 'Vendas';
  let equipe = '';
  let projeto = '';

  const clientMatch = findClientMapping(invoice.takerName, clientMappings);
  if (clientMatch) {
    normalizedClientName = clientMatch.para;
    account = clientMatch.account || 'Vendas';

    // Encontrar dados de alocação
    const allocation = findAllocationData(normalizedClientName, allocationData);
    if (allocation) {
      equipe = allocation.equipe;
      projeto = allocation.projeto;
    }
  }

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
    'Customer Name': normalizedClientName,
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
    'Project Name': projeto,
    'Account': account,
    'Notes': `NFS-e ${invoice.nfsNumber} - Equipe: ${equipe} - Emitente: ${invoice.issuerName}`,
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
 * Exporta invoices para formato ZOHO em Excel com matching
 */
export function exportToZOHOExcel(
  invoices: ExtractedInvoice[],
  referenceData: Record<string, unknown>[] | null = null
): void {
  // Extrair dados de referência se disponível
  let taxMappings: TaxMapping[] = [];
  let clientMappings: ClientMapping[] = [];
  let allocationData: AllocationData[] = [];

  if (referenceData && referenceData.length > 0) {
    // Assumir que referenceData contém dados da primeira aba (impostos)
    taxMappings = extractTaxMappings(referenceData);
  }

  const zohoData = invoices.map((invoice) =>
    convertToZOHO(invoice, taxMappings, clientMappings, allocationData)
  );

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
 * Exporta invoices para formato ZOHO em CSV com matching
 */
export function exportToZOHOCSV(
  invoices: ExtractedInvoice[],
  referenceData: Record<string, unknown>[] | null = null
): string {
  // Extrair dados de referência se disponível
  let taxMappings: TaxMapping[] = [];
  let clientMappings: ClientMapping[] = [];
  let allocationData: AllocationData[] = [];

  if (referenceData && referenceData.length > 0) {
    taxMappings = extractTaxMappings(referenceData);
  }

  const zohoData = invoices.map((invoice) =>
    convertToZOHO(invoice, taxMappings, clientMappings, allocationData)
  );

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
