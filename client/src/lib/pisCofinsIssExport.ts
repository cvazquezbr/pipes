/**
 * Utilitários para exportação de COFINS/PIS e ISS
 */

import * as XLSX from 'xlsx';

/**
 * Exporta dados de faturamento e cobrança para Excel
 */
export function exportPisCofinsIssExcel(
  invoiceData: Record<string, unknown>[],
  billData: Record<string, unknown>[]
): void {
  const workbook = XLSX.utils.book_new();

  // Criar aba de Faturas
  const invoiceSheet = XLSX.utils.json_to_sheet(invoiceData);
  XLSX.utils.book_append_sheet(workbook, invoiceSheet, 'Faturamento');

  // Criar aba de Cobranças (filtradas)
  const billSheet = XLSX.utils.json_to_sheet(billData);
  XLSX.utils.book_append_sheet(workbook, billSheet, 'Cobranças ISS');

  // Criar aba de Cruzamento (opcional, mas útil)
  const mergedData = matchInvoicesAndBills(invoiceData, billData);
  const mergedSheet = XLSX.utils.json_to_sheet(mergedData);
  XLSX.utils.book_append_sheet(workbook, mergedSheet, 'Cruzamento');

  const filename = `PIS-COFINS-ISS-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Tenta cruzar faturas com cobranças
 */
function matchInvoicesAndBills(
  invoiceData: Record<string, unknown>[],
  billData: Record<string, unknown>[]
) {
  return invoiceData.map(invoice => {
    const invNumber = String(invoice['Invoice Number'] || '').trim();

    // Procura cobrança correspondente (que contenha o número da fatura)
    const matchedBill = billData.find(bill => {
      const billNumber = String(bill['Bill Number'] || '').toUpperCase();
      return billNumber.includes(invNumber) && invNumber !== '';
    });

    return {
      'Fatura': invNumber,
      'Data Fatura': invoice['Invoice Date'],
      'Cliente': invoice['Customer Name'],
      'Status Fatura': invoice['Invoice Status'],
      'Total Fatura': invoice['Total'],
      'Imposto Item': invoice['Item Tax Amount'],
      'Cobrança Correspondente': matchedBill ? matchedBill['Bill Number'] : 'Não encontrada',
      'Data Cobrança': matchedBill ? matchedBill['Bill Date'] : '',
      'Total Cobrança': matchedBill ? matchedBill['Total'] : '',
      'Status Cobrança': matchedBill ? matchedBill['Bill Status'] : '',
      'Projeto': invoice['Project Name'],
      'Equipe': invoice['Equipe']
    };
  });
}
