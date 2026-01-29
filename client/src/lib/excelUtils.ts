/**
 * Utilitários para processamento de arquivos Excel
 * Leitura de planilhas de referência e exportação de resultados
 */

import * as XLSX from 'xlsx';
import type { ExtractedInvoice } from './types';

/**
 * Lê arquivo Excel e retorna dados como array de objetos
 */
export async function readExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo Excel'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Converte número em centavos para formato monetário brasileiro
 */
function formatCurrency(cents: number): string {
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Exporta dados extraídos para CSV
 */
export function exportToCSV(invoices: ExtractedInvoice[]): string {
  const headers = [
    'Arquivo',
    'Número NFS-e',
    'Série DPS',
    'Data Emissão',
    'Hora Emissão',
    'Emitente',
    'CNPJ Emitente',
    'Telefone Emitente',
    'Endereço Emitente',
    'Cidade Emitente',
    'Estado Emitente',
    'CEP Emitente',
    'Tomador',
    'CNPJ Tomador',
    'Endereço Tomador',
    'Cidade Tomador',
    'Estado Tomador',
    'CEP Tomador',
    'Código Serviço',
    'Descrição Serviço',
    'Valor Serviço',
    'Deduções',
    'IRRF',
    'PIS',
    'COFINS',
    'CSLL',
    'Base ISSQN',
    'ISSQN Apurado',
    'Alíquota ISSQN',
    'Suspensão ISSQN',
    'Município ISSQN',
    'Tributação ISSQN',
    'CP',
    'ISSQN Retido',
    'Total Impostos',
    'Valor Líquido',
    'Confiança Extração',
    'Erros',
  ];

  const rows = invoices.map((invoice) => [
    invoice.filename,
    invoice.nfsNumber,
    invoice.seriesNumber,
    invoice.emissionDate,
    invoice.emissionTime,
    invoice.issuerName,
    invoice.issuerCNPJ,
    invoice.issuerPhone,
    invoice.issuerAddress,
    invoice.issuerCity,
    invoice.issuerState,
    invoice.issuerCEP,
    invoice.takerName,
    invoice.takerCNPJ,
    invoice.takerAddress,
    invoice.takerCity,
    invoice.takerState,
    invoice.takerCEP,
    invoice.serviceCode,
    invoice.serviceDescription,
    formatCurrency(invoice.serviceValue),
    formatCurrency(invoice.deductions),
    formatCurrency(invoice.irrf),
    formatCurrency(invoice.pis),
    formatCurrency(invoice.cofins),
    formatCurrency(invoice.csll),
    formatCurrency(invoice.issqnBase),
    formatCurrency(invoice.issqnApurado),
    invoice.issqnAliquota,
    invoice.issqnSuspensao,
    invoice.issqnMunicipio,
    invoice.issqnTributacao,
    formatCurrency(invoice.issqnCP),
    formatCurrency(invoice.issqnRetido),
    formatCurrency(invoice.totalTaxes),
    formatCurrency(invoice.netValue),
    (invoice.extractionConfidence * 100).toFixed(1) + '%',
    (invoice.extractionErrors || []).join('; '),
  ]);

  // Escapar valores com vírgulas
  const csvContent = [
    headers.map((h) => `"${h}"`).join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const cellStr = String(cell || '');
          return `"${cellStr.replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ].join('\n');

  return csvContent;
}

/**
 * Exporta dados para Excel com formatação
 */
export function exportToExcel(invoices: ExtractedInvoice[]): void {
  const data = invoices.map((invoice) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [Symbol.iterator]: undefined as any,
    'Arquivo': invoice.filename,
    'Número NFS-e': invoice.nfsNumber,
    'Chave de Acesso': invoice.accessKey,
    'Data Emissão': invoice.emissionDate,
    'Hora Emissão': invoice.emissionTime,
    'Emitente': invoice.issuerName,
    'CNPJ Emitente': invoice.issuerCNPJ,
    'Endereço Emitente': invoice.issuerAddress,
    'Cidade Emitente': invoice.issuerCity,
    'Estado Emitente': invoice.issuerState,
    'CEP Emitente': invoice.issuerCEP,
    'Tomador': invoice.takerName,
    'CNPJ Tomador': invoice.takerCNPJ,
    'Endereço Tomador': invoice.takerAddress,
    'Cidade Tomador': invoice.takerCity,
    'Estado Tomador': invoice.takerState,
    'CEP Tomador': invoice.takerCEP,
    'Código Serviço': invoice.serviceCode,
    'Descrição Serviço': invoice.serviceDescription,
    'Valor Serviço': formatCurrency(invoice.serviceValue),
    'Deduções': formatCurrency(invoice.deductions),
    'IRRF': formatCurrency(invoice.irrf),
    'PIS': formatCurrency(invoice.pis),
    'COFINS': formatCurrency(invoice.cofins),
    'CSLL': formatCurrency(invoice.csll),
    'ISSQN Apurado': formatCurrency(invoice.issqnApurado),
    'ISSQN Base': formatCurrency(invoice.issqnBase),
    'ISSQN Alíquota': invoice.issqnAliquota,
    'ISSQN Suspensão': invoice.issqnSuspensao,
    'ISSQN Município': invoice.issqnMunicipio,
    'ISSQN Tributação': invoice.issqnTributacao,
    'ISSQN CP': formatCurrency(invoice.issqnCP),
    'ISSQN Retido': formatCurrency(invoice.issqnRetido),
    'Total Impostos': formatCurrency(invoice.totalTaxes),
    'Valor Líquido': formatCurrency(invoice.netValue),
    'Confiança Extração': (invoice.extractionConfidence * 100).toFixed(1) + '%',
    'Erros': (invoice.extractionErrors || []).join('; '),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Notas Fiscais');

  // Ajustar largura das colunas
  const colWidths = Object.keys(data[0] || {}).map(() => 20);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (worksheet as any)['!cols'] = colWidths.map((width) => ({ wch: width }));

  XLSX.writeFile(workbook, `notas-fiscais-${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Exporta dados para JSON
 */
export function exportToJSON(invoices: ExtractedInvoice[]): string {
  return JSON.stringify(invoices, null, 2);
}

/**
 * Baixa arquivo de texto
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
