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
  outros: number;
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
  dueDateDays?: number;
}

/**
 * Converte valor da planilha de referência para número, lidando com formatos brasileiros
 */
function parseReferenceValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value === undefined || value === null || value === '') return 0;

  const str = String(value).trim();
  // Remove % e espaços, troca vírgula por ponto se necessário
  const cleaned = str.replace('%', '').replace(/\s/g, '');

  // Se contém vírgula, assume formato brasileiro
  if (cleaned.includes(',')) {
    // Se também contém ponto, o ponto é separador de milhar
    if (cleaned.includes('.')) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(cleaned.replace(',', '.')) || 0;
  }

  return parseFloat(cleaned) || 0;
}

/**
 * Extrai dados de impostos da primeira aba do Excel
 */
export function extractTaxMappings(data: ExcelReferenceData[]): TaxMapping[] {
  return data.map((row) => {
    // Prioriza 'Item Tax1 %_1' (padrão xlsx para duplicados) ou 'Item Tax1 %2'
    const rawPercent =
      row['Item Tax1 %_1'] !== undefined && row['Item Tax1 %_1'] !== ''
        ? row['Item Tax1 %_1']
        : row['Item Tax1 %2'] !== undefined && row['Item Tax1 %2'] !== ''
          ? row['Item Tax1 %2']
          : row['Item Tax1 %'];

    const percentual = parseReferenceValue(rawPercent);

    let itemTax1Percent = String(row['Item Tax1 %_1'] || row['Item Tax1 %2'] || row['Item Tax1 %'] || '0.00%');

    // Se for apenas um número sem o símbolo %, formata como percentual
    if (itemTax1Percent && !itemTax1Percent.includes('%') && !isNaN(Number(itemTax1Percent.replace(',', '.')))) {
      itemTax1Percent = parseFloat(itemTax1Percent.replace(',', '.')).toFixed(2) + '%';
    }

    return {
      percentual,
      itemTax1: String(row['Item Tax1'] || ''),
      itemTax1Type: String(row['Item Tax1 Type'] || 'Tax'),
      isInclusiveTax: String(row['Is Inclusive Tax'] || 'false'),
      itemTax1Percent,
      irpj: parseReferenceValue(row['IRPJ']),
      csll: parseReferenceValue(row['CSLL']),
      cofins: parseReferenceValue(row['COFINS']),
      pis: parseReferenceValue(row['PIS']),
      iss: parseReferenceValue(row['ISS']),
      outros: parseReferenceValue(row['Outros']),
    };
  });
}

/**
 * Extrai dados de cliente (de-para) da segunda aba do Excel
 */
export function extractClientMappings(data: ExcelReferenceData[]): ClientMapping[] {
  return data.map((row) => {
    const keys = Object.keys(row);
    return {
      de: String(row['DE'] || row[keys[0]] || '').trim().toUpperCase(),
      para: String(row['PARA'] || row[keys[1]] || '').trim(),
      account: String(row['Account'] || row[keys[2]] || 'Vendas'),
    };
  });
}

/**
 * Extrai dados de alocação da terceira aba do Excel
 */
export function extractAllocationData(data: ExcelReferenceData[]): AllocationData[] {
  return data.map((row) => {
    const keys = Object.keys(row);

    // Extrai o valor da 4ª coluna (por nome ou posição)
    const rawDays = (row['Vencimento'] !== undefined && row['Vencimento'] !== '')
      ? row['Vencimento']
      : (row['Due Date Days'] !== undefined && row['Due Date Days'] !== '')
        ? row['Due Date Days']
        : row[keys[3]];

    // Se o valor estiver ausente ou for uma string vazia, deixamos como undefined
    const dueDateDays = (rawDays !== undefined && rawDays !== null && rawDays !== '')
      ? parseReferenceValue(rawDays)
      : undefined;

    return {
      cliente: String(row['Cliente'] || row['Customer Name'] || row[keys[0]] || '').trim(),
      equipe: String(row['Equipe'] || row[keys[1]] || ''),
      projeto: String(row['Projeto'] || row['Project Name'] || row[keys[2]] || ''),
      dueDateDays,
    };
  });
}

/**
 * Calcula o percentual total de retenção
 * Baseado em: (Valor Serviço - Valor Líquido) * 100 / Valor Serviço
 * Que é equivalente à dedução percentual
 */
function calculateTotalRetentionPercentage(invoice: ExtractedInvoice): number {
  if (invoice.serviceValue === 0) return 0;
  const deduction = invoice.serviceValue - invoice.netValue;
  const percentage = (deduction * 100) / invoice.serviceValue;
  console.log(`[ZOHO] Calculando retenção para NF ${invoice.nfsNumber}:`, {
    valorServico: invoice.serviceValue / 100,
    valorLiquido: invoice.netValue / 100,
    deducao: deduction / 100,
    percentual: percentage.toFixed(4) + '%'
  });
  return percentage;
}

/**
 * Encontra o mapeamento de imposto mais próximo pelo percentual
 */
function findTaxMapping(
  retentionPercentage: number,
  taxMappings: TaxMapping[]
): TaxMapping {
  console.log(`[ZOHO] Buscando esquema de tributação para ${retentionPercentage.toFixed(2)}%...`);

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
      outros: 0,
    };
  }

  // Encontra o mapeamento com percentual mais próximo
  const match = taxMappings.reduce((prev, curr) =>
    Math.abs(curr.percentual - retentionPercentage) <
    Math.abs(prev.percentual - retentionPercentage)
      ? curr
      : prev
  );

  console.log(`[ZOHO] Esquema selecionado:`, {
    percentualEsperado: retentionPercentage.toFixed(2) + '%',
    percentualEncontrado: match.percentual.toFixed(2) + '%',
    taxName: match.itemTax1,
    taxPercent: match.itemTax1Percent,
    diferenca: Math.abs(match.percentual - retentionPercentage).toFixed(4)
  });

  return match;
}

/**
 * Encontra o cliente normalizado pelo nome original
 */
function findClientMapping(
  originalName: string,
  clientMappings: ClientMapping[]
): ClientMapping | null {
  const normalized = originalName.trim().toUpperCase();
  console.log('[ZOHO] Buscando cliente:', { originalName, normalized, totalMappings: clientMappings.length });
  if (clientMappings.length > 0) {
    console.log('[ZOHO] Primeiros 3 mapeamentos:', clientMappings.slice(0, 3).map(m => ({ de: m.de, para: m.para })));
  }
  const result = clientMappings.find((m) => m.de === normalized);
  console.log('[ZOHO] Resultado do match:', result ? result.para : 'NAO ENCONTRADO');
  return result || null;
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
 * Determina a conta contábil baseada em palavras-chave na descrição do item
 */
function determineAccountFromDescription(description: string): string | null {
  const desc = (description || '').toUpperCase();

  if (desc.includes('VGPF')) return 'VGPF-EAD';
  if (desc.includes('CAPF')) return 'CAPF EAD';
  if (desc.includes('PCOSMIC-EAD')) return 'COSMIC-EAD';
  if (desc.includes('CFPS')) return 'PCFPS-EAD';
  if (desc.includes('SNAP')) return 'SNAP-EAD';
  if (desc.includes('EREQ')) return 'EREQ EAD';
  if (desc.includes('ETSW')) return 'ESTIMATIVAS EAD';

  return null;
}

/**
 * Headers fixos para exportação ZOHO garantindo ordem e presença de colunas
 */
const ZOHO_HEADERS = [
  'Invoice Date',
  'Due Date',
  'Invoice Number',
  'Invoice Status',
  'Customer Name',
  'Template Name',
  'Currency Code',
  'Exchange Rate',
  'SKU',
  'Item Desc',
  'Quantity',
  'Item Price',
  'Adjustment',
  'Adjustment Description',
  'Usage unit',
  'Discount',
  'Is Inclusive Tax',
  'Item Tax1',
  'Item Tax1 Type',
  'Item Tax1 %',
  'Project Name',
  'Equipe',
  'Account',
  'Notes',
  'Terms & Conditions',
];

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
  let dueDateDays: number | undefined = undefined;

  const clientMatch = findClientMapping(invoice.takerName, clientMappings);
  if (clientMatch) {
    normalizedClientName = clientMatch.para;
    account = clientMatch.account || 'Vendas';

    // Encontrar dados de alocação
    const allocation = findAllocationData(normalizedClientName, allocationData);
    if (allocation) {
      equipe = allocation.equipe;
      projeto = allocation.projeto;
      dueDateDays = allocation.dueDateDays;
    }
  }

  // Ajustar conta baseado na descrição (sobrescreve se houver match)
  const specialAccount = determineAccountFromDescription(invoice.serviceDescription);
  if (specialAccount) {
    console.log(`[ZOHO] Conta ajustada por descrição: ${account} -> ${specialAccount}`);
    account = specialAccount;
  }

  // Calcular deducao (Valor Servico - Valor Liquido)
  const deduction = invoice.serviceValue - invoice.netValue;

  // Converter centavos para reais
  const itemPrice = invoice.serviceValue / 100;
  const adjustment = -(deduction / 100);

  const hasTax = taxMapping.percentual > 0;
  const formattedInvoiceDate = formatDate(invoice.emissionDate);

  return {
    'Invoice Date': formattedInvoiceDate,
    'Due Date': calculateDueDate(invoice.emissionDate, dueDateDays),
    'Invoice Number': invoice.nfsNumber,
    'Invoice Status': invoice.isCancelled ? 'Void' : 'draft',
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
    'Is Inclusive Tax': hasTax ? taxMapping.isInclusiveTax : 'false',
    'Item Tax1': hasTax ? taxMapping.itemTax1 : '',
    'Item Tax1 Type': hasTax ? taxMapping.itemTax1Type : '',
    'Item Tax1 %': hasTax ? taxMapping.itemTax1Percent : '',
    'Project Name': projeto,
    'Equipe': equipe,
    'Account': account,
    'Notes': `NFS-e ${invoice.nfsNumber} - Equipe: ${equipe} - Emitente: ${invoice.issuerName}`,
    'Terms & Conditions': '',
  };
}

/**
 * Formata data de DD/MM/YYYY para YYYY-MM-DD
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';

  // Se já está em DD/MM/YYYY, converte para YYYY-MM-DD
  const dmyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }

  // Tenta converter de outros formatos
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
}

/**
 * Calcula a data de vencimento a partir da data de emissão e número de dias
 */
function calculateDueDate(invoiceDateStr: string, days: number | undefined): string {
  if (!invoiceDateStr || days === undefined) return '';

  let date: Date;
  const dmyMatch = invoiceDateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (dmyMatch) {
    date = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  } else {
    date = new Date(invoiceDateStr);
  }

  if (isNaN(date.getTime())) return formatDate(invoiceDateStr);

  if (days > 0) {
    date.setDate(date.getDate() + days);
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Exporta invoices para formato ZOHO em Excel com matching
 */
export function exportToZOHOExcel(
  invoices: ExtractedInvoice[],
  referenceData: Record<string, unknown>[] | null = null,
  allSheets: Record<string, Record<string, unknown>[]> | null = null
): void {
  // Extrair dados de referencia se disponivel
  let taxMappings: TaxMapping[] = [];
  let clientMappings: ClientMapping[] = [];
  let allocationData: AllocationData[] = [];

  if (allSheets) {
    const sheetNames = Object.keys(allSheets);
    if (sheetNames.length > 0 && allSheets[sheetNames[0]]) {
      taxMappings = extractTaxMappings(allSheets[sheetNames[0]]);
    }
    if (sheetNames.length > 1 && allSheets[sheetNames[1]]) {
      clientMappings = extractClientMappings(allSheets[sheetNames[1]]);
    }
    if (sheetNames.length > 2 && allSheets[sheetNames[2]]) {
      console.log(`[ZOHO] Extraindo dados de alocação da 3ª aba: ${sheetNames[2]}`);
      allocationData = extractAllocationData(allSheets[sheetNames[2]]);
    }
  } else if (referenceData && referenceData.length > 0) {
    taxMappings = extractTaxMappings(referenceData);
  }

  // Agrupa invoices por nfsNumber para aplicar regra de cancelamento/duplicidade
  const grouped = invoices.reduce((acc, inv) => {
    if (inv.nfsNumber) {
      if (!acc[inv.nfsNumber]) acc[inv.nfsNumber] = [];
      acc[inv.nfsNumber].push(inv);
    }
    return acc;
  }, {} as Record<string, ExtractedInvoice[]>);

  const filteredInvoices = Object.values(grouped).flatMap((group) => {
    // SE houver mais de um registro com o mesmo número de NF,
    // apenas o registro cancelado deve ser incluído.
    if (group.length > 1) {
      const cancelledInGroup = group.filter((inv) => inv.isCancelled);
      if (cancelledInGroup.length > 0) {
        return cancelledInGroup;
      }
    }
    return group;
  });

  const zohoData = filteredInvoices.map((invoice) =>
    convertToZOHO(invoice, taxMappings, clientMappings, allocationData)
  );

  const worksheet = XLSX.utils.json_to_sheet(zohoData, { header: ZOHO_HEADERS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Notas Fiscais');

  // Ajustar largura das colunas
  const colWidths = ZOHO_HEADERS.map(() => 25);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (worksheet as any)['!cols'] = colWidths.map((width) => ({ wch: width }));

  const filename = `ZOHO-Carga-Faturas-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
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
  // Agrupa invoices por nfsNumber para aplicar regra de cancelamento/duplicidade
  const grouped = invoices.reduce((acc, inv) => {
    // Mantém invoices sem nfsNumber para reportar no issues
    const key = inv.nfsNumber || 'MISSING';
    if (!acc[key]) acc[key] = [];
    acc[key].push(inv);
    return acc;
  }, {} as Record<string, ExtractedInvoice[]>);

  const filteredInvoices = Object.entries(grouped).flatMap(([key, group]) => {
    if (key === 'MISSING') return group;

    // SE houver mais de um registro com o mesmo número de NF,
    // apenas o registro cancelado deve ser incluído.
    if (group.length > 1) {
      const cancelledInGroup = group.filter((inv) => inv.isCancelled);
      if (cancelledInGroup.length > 0) {
        return cancelledInGroup;
      }
    }
    return group;
  });

  const issues: Array<{ nfsNumber: string; issue: string }> = [];

  filteredInvoices.forEach((invoice) => {
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
    totalInvoices: filteredInvoices.length,
    validInvoices: filteredInvoices.length - issues.length,
    invalidInvoices: issues.length,
    issues,
  };
}
