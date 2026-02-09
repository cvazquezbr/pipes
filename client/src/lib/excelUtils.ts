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
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, unknown>[];

        // Formata datas para YYYY-MM-DD
        const formattedData = jsonData.map(row => {
          const newRow = { ...row };
          Object.keys(newRow).forEach(key => {
            const value = newRow[key];
            const lowerKey = key.toLowerCase();
            const isDateCol = lowerKey.includes('date') || lowerKey.includes('data') || lowerKey.includes('vencimento');

            if (value instanceof Date) {
              const year = value.getFullYear();
              const month = String(value.getMonth() + 1).padStart(2, '0');
              const day = String(value.getDate()).padStart(2, '0');
              newRow[key] = `${year}-${month}-${day}`;
            } else if (typeof value === 'number' && isDateCol && value > 30000 && value < 60000) {
              // Fallback para números que parecem ser datas do Excel (serial)
              try {
                const date = new Date((value - 25569) * 86400 * 1000);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                newRow[key] = `${year}-${month}-${day}`;
              } catch (e) {
                // Mantém original se falhar
              }
            }
          });
          return newRow;
        });

        resolve(formattedData);
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Exporta dados extraídos para CSV
 */
export function exportToCSV(invoices: ExtractedInvoice[]): string {
  if (invoices.length === 0) return '';

  const reportData = invoices.map(mapInvoiceToReport);
  const headers = Object.keys(reportData[0]);

  // Escapar valores com vírgulas
  const csvContent = [
    headers.map((h) => `"${h}"`).join(','),
    ...reportData.map((row) =>
      headers
        .map((header) => {
          const cell = (row as any)[header];
          const cellStr = String(cell || '');
          return `"${cellStr.replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ].join('\n');

  return csvContent;
}

/**
 * Mapeia invoice para formato de relatório de conferência
 */
function mapInvoiceToReport(invoice: ExtractedInvoice) {
  return {
    'Arquivo': invoice.filename,
    'Número NFS-e': invoice.nfsNumber,
    'Status': invoice.isCancelled ? 'CANCELADA' : 'ATIVA',
    'Chave de Acesso': invoice.accessKey,
    'Série DPS': invoice.seriesNumber,
    'Data Emissão': invoice.emissionDate,
    'Hora Emissão': invoice.emissionTime,
    'Emitente': invoice.issuerName,
    'CNPJ Emitente': invoice.issuerCNPJ,
    'Telefone Emitente': invoice.issuerPhone || '',
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
    'CP': formatCurrency(invoice.cp),
    'CSLL': formatCurrency(invoice.csll),
    'PIS Devido': formatCurrency(invoice.pis),
    'PIS Retido': formatCurrency(invoice.pisRetido),
    'PIS Pendente': formatCurrency(invoice.pisPendente),
    'COFINS Devido': formatCurrency(invoice.cofins),
    'COFINS Retido': formatCurrency(invoice.cofinsRetido),
    'COFINS Pendente': formatCurrency(invoice.cofinsPendente),
    'Retenção do PIS/COFINS': invoice.pisCofinsRetention,
    'Outros': formatCurrency(invoice.other),
    'ISSQN Base': formatCurrency(invoice.issqnBase),
    'ISSQN Apurado': formatCurrency(invoice.issqnApurado),
    'ISSQN Alíquota': invoice.issqnAliquota,
    'ISSQN Suspensão': invoice.issqnSuspensao,
    'ISSQN Município': invoice.issqnMunicipio,
    'ISSQN Tributação': invoice.issqnTributacao,
    'ISSQN Retido': formatCurrency(invoice.issqnRetido),
    'Total Impostos': formatCurrency(invoice.totalTaxes),
    'Valor Líquido': formatCurrency(invoice.netValue),
    'Confiança Extração': (invoice.extractionConfidence * 100).toFixed(1) + '%',
    'Erros': (invoice.extractionErrors || []).join('; '),
  };
}

/**
 * Exporta dados para Excel com formatação
 */
export function exportToExcel(invoices: ExtractedInvoice[]): void {
  const data = invoices.map((invoice) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [Symbol.iterator]: undefined as any,
    ...mapInvoiceToReport(invoice)
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
  return JSON.stringify(invoices.map(mapInvoiceToReport), null, 2);
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

/**
 * Lê todas as abas do arquivo Excel
 */
export async function readExcelFileAllSheets(
  file: File
): Promise<Record<string, Record<string, unknown>[]>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const result: Record<string, Record<string, unknown>[]> = {};

        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, unknown>[];

          // Formata datas para YYYY-MM-DD
          const formattedData = jsonData.map(row => {
            const newRow = { ...row };
            Object.keys(newRow).forEach(key => {
              const value = newRow[key];
              const lowerKey = key.toLowerCase();
              const isDateCol = lowerKey.includes('date') || lowerKey.includes('data') || lowerKey.includes('vencimento');

              if (value instanceof Date) {
                const year = value.getFullYear();
                const month = String(value.getMonth() + 1).padStart(2, '0');
                const day = String(value.getDate()).padStart(2, '0');
                newRow[key] = `${year}-${month}-${day}`;
              } else if (typeof value === 'number' && isDateCol && value > 30000 && value < 60000) {
                // Fallback para números que parecem ser datas do Excel (serial)
                try {
                  const date = new Date((value - 25569) * 86400 * 1000);
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  newRow[key] = `${year}-${month}-${day}`;
                } catch (e) {
                  // Mantém original se falhar
                }
              }
            });
            return newRow;
          });

          result[sheetName] = formattedData;
        });

        resolve(result);
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
