/**
 * Utilitários para exportação de IRPJ e CSLL (Trimestral)
 * Implementa a lógica de cálculo de impostos conforme script R
 */

import * as XLSX from 'xlsx';
import {
  round2,
  parseNumber,
  getVal,
  parseReferenceValue,
  findTaxMapping,
  calculateDates
} from './taxUtils';

// Alíquotas padrão
const ALIQUOTAS = {
  IRPJ: 0.048,
  CSLL: 0.0288,
  PRESUNCAO_LUCRO: 0.32,
  IR_ALIQUOTA: 0.15,
  IR_ADICIONAL: 0.10,
  CSLL_ALIQUOTA: 0.09,
  LIMITE_IR_ADICIONAL: 60000,
  LIMITE_FAIXA: 1250000,
  ALIQUOTA_EXCEDENTE: 0.352,
};

/**
 * Processa dados de faturamento para cálculo de IRPJ e CSLL
 */
export function processIrpjCsllData(
  invoiceData: Record<string, unknown>[],
  allSheets: Record<string, Record<string, unknown>[]> | null,
  resultadoAplicacao: number = 0,
  retencaoAplicacao: number = 0
) {
  const dates = calculateDates();

  // 1. Carga de impostos de referência (1ª aba)
  let taxMappings: Record<string, any>[] = [];
  if (allSheets) {
    const firstSheetName = Object.keys(allSheets)[0];
    taxMappings = allSheets[firstSheetName] || [];
  }

  // 2. Processamento de Faturas
  let faturas = invoiceData.map(row => {
    const invoiceDate = String(getVal(row, 'Invoice Date') || '');
    const invoiceStatus = String(getVal(row, 'Invoice Status') || '');
    const invoiceNumber = String(getVal(row, 'Invoice Number') || '');

    return {
      ...row,
      InvoiceDateFormatted: invoiceDate,
      InvoiceStatus: invoiceStatus,
      InvoiceNumber: invoiceNumber,
      CustomerName: String(getVal(row, 'Customer Name') || ''),
      Total: parseNumber(getVal(row, 'Total')),
      ItemTax: String(getVal(row, 'Item Tax') || ''),
      ProjectName: String(getVal(row, 'Project Name') || ''),
      Equipe: String(getVal(row, 'Equipe') || ''),
      ItemTaxAmount: parseNumber(getVal(row, 'Item Tax Amount'))
    };
  });

  // Filtros: Status
  faturas = faturas.filter(f => {
    return f.InvoiceStatus !== 'Void' && f.InvoiceStatus !== 'Draft';
  });

  // Cálculos por fatura
  let faturasProcessadas = faturas.map(f => {
    const retentionPercentage = f.Total !== 0 ? (f.ItemTaxAmount * 100) / f.Total : 0;
    const mapping = findTaxMapping(retentionPercentage, taxMappings, f.ItemTax);

    const irpjRetPerc = parseReferenceValue(getVal(mapping || {}, 'IRPJ'));
    const csllRetPerc = parseReferenceValue(getVal(mapping || {}, 'CSLL'));

    const irpjDevido = round2(f.Total * ALIQUOTAS.IRPJ);
    const irpjRetido = round2(f.Total * irpjRetPerc);
    const irpjPendente = irpjDevido - irpjRetido;

    const csllDevido = round2(f.Total * ALIQUOTAS.CSLL);
    const csllRetido = round2(f.Total * csllRetPerc);
    const csllPendente = csllDevido - csllRetido;

    return {
      ...f,
      'ItemTaxScheme': mapping ? String(getVal(mapping, 'Item Tax', 'Item Tax1') || '') : 'Não encontrado',
      'IRPJ.devido': irpjDevido,
      'IRPJ.retido': irpjRetido,
      'IRPJ.pendente': irpjPendente,
      'CSLL.devido': csllDevido,
      'CSLL.retido': csllRetido,
      'CSLL.pendente': csllPendente,
    };
  });

  // Cálculos Totais
  const totalFaturado = faturasProcessadas.reduce((sum, f) => sum + f.Total, 0);

  // Adicional IRPJ (BASE) apenas se houver fatura com emissão posterior a 2025
  const hasInvoicesAfter2025 = faturasProcessadas.some(f => {
    const year = parseInt(String(f.InvoiceDateFormatted || '').split('-')[0]);
    return year > 2025;
  });

  const presuncaoLucro = hasInvoicesAfter2025 
    ? (Math.min(totalFaturado, ALIQUOTAS.LIMITE_FAIXA) * ALIQUOTAS.PRESUNCAO_LUCRO) + 
      (Math.max(0, totalFaturado - ALIQUOTAS.LIMITE_FAIXA) * ALIQUOTAS.ALIQUOTA_EXCEDENTE)
    : (totalFaturado * ALIQUOTAS.PRESUNCAO_LUCRO);
  
  const baseCalculo = presuncaoLucro + resultadoAplicacao;

  // IRPJ Total
  const irDevido = baseCalculo * ALIQUOTAS.IR_ALIQUOTA;

  const irAdicional = Math.max(0, baseCalculo - ALIQUOTAS.LIMITE_IR_ADICIONAL) * ALIQUOTAS.IR_ADICIONAL;

  const irRetidoTotal = faturasProcessadas.reduce((sum, f) => sum + f['IRPJ.retido'], 0) + retencaoAplicacao;
  const totalIrpjDevido = irDevido + irAdicional - irRetidoTotal;

  // CSLL Total
  const csllDevidoTotal = baseCalculo * ALIQUOTAS.CSLL_ALIQUOTA;
  const csllRetidoTotal = faturasProcessadas.reduce((sum, f) => sum + f['CSLL.retido'], 0);
  const totalCsllDevido = csllDevidoTotal - csllRetidoTotal;

  // Distribuição para as faturas (para carga Zoho)
  let faturasFinais: any[] = faturasProcessadas;

  if (totalFaturado > 0) {
    faturasFinais = faturasProcessadas.map(f => {
      const percentualContribuicao = f.Total / totalFaturado;
      return {
        ...f,
        percentualContribuicao,
        'contribuicao.IRPJ': round2(totalIrpjDevido * percentualContribuicao),
        'contribuicao.CSLL': round2(totalCsllDevido * percentualContribuicao),
      };
    });

    // Ajuste de arredondamento na última linha
    if (faturasFinais.length > 0) {
      const lastIndex = faturasFinais.length - 1;
      const sumIrpjExceptLast = faturasFinais.slice(0, lastIndex).reduce((sum, f) => sum + (f['contribuicao.IRPJ'] || 0), 0);
      const sumCsllExceptLast = faturasFinais.slice(0, lastIndex).reduce((sum, f) => sum + (f['contribuicao.CSLL'] || 0), 0);

      faturasFinais[lastIndex]['contribuicao.IRPJ'] = round2(totalIrpjDevido - sumIrpjExceptLast);
      faturasFinais[lastIndex]['contribuicao.CSLL'] = round2(totalCsllDevido - sumCsllExceptLast);
    }
  }

  return {
    faturasFinais,

    resumo: {
      totalFaturado,
      presuncaoLucro,
      baseCalculo,
      resultadoAplicacao,
      retencaoAplicacao,
      irDevido,
      irAdicional,
      irRetidoTotal,
      totalIrpjDevido,
      csllDevidoTotal,
      csllRetidoTotal,
      totalCsllDevido
    },
    dates
  };
}

/**
 * Exporta dados de IRPJ e CSLL para Excel
 */
export function exportIrpjCsllExcel(
  invoiceData: Record<string, unknown>[],
  allSheets: Record<string, Record<string, unknown>[]> | null,
  resultadoAplicacao: number,
  retencaoAplicacao: number
): void {
  const { faturasFinais, dates } = processIrpjCsllData(invoiceData, allSheets, resultadoAplicacao, retencaoAplicacao);

  const ZOHO_BILL_HEADERS = [
    'Currency Code', 'Conta para quitação', 'Bill Type', 'Exchange Rate', 'Quantity',
    'Is Inclusive Tax', 'Is Billable', 'Is Landed Cost', 'Is Discount Before Tax',
    'Bill Status', 'Discount Type', 'Bill Number', 'Account', 'Description',
    'Customer Name', 'Project Name', 'Equipe', 'Bill Date', 'Vendor Name',
    'Rate', 'Due Date'
  ];

  const prepareZohoRow = (entrada: any, tipo: 'IRPJ' | 'CSLL') => {
    const rate = tipo === 'IRPJ' ? entrada['contribuicao.IRPJ'] : entrada['contribuicao.CSLL'];
    if (round2(rate) === 0) return null;

    const billDate = tipo === 'IRPJ' ? dates.dataIRPJ : dates.dataCSLL;

    const row: Record<string, any> = {};
    ZOHO_BILL_HEADERS.forEach(h => row[h] = '');

    row['Currency Code'] = 'BRL';
    row['Conta para quitação'] = 'Banco do Brasil';
    row['Bill Type'] = 'Bill';
    row['Exchange Rate'] = 1;
    row['Quantity'] = 1;
    row['Is Inclusive Tax'] = 'false';
    row['Is Billable'] = 'false';
    row['Is Landed Cost'] = 'false';
    row['Is Discount Before Tax'] = 'true';
    row['Bill Status'] = 'draft';
    row['Discount Type'] = 'entity_level';
    row['Bill Number'] = `${tipo} TRIMESTRAL`;
    row['Account'] = tipo === 'IRPJ' ? 'IRPJ' : 'CSLL';
    row['Description'] = `NF ${entrada.InvoiceNumber} ${entrada.CustomerName} de ${entrada.InvoiceDateFormatted}`;
    row['Customer Name'] = entrada.CustomerName;
    row['Project Name'] = entrada.ProjectName;
    row['Equipe'] = entrada.Equipe;
    row['Bill Date'] = billDate;
    row['Vendor Name'] = 'RECEITA FEDERAL';
    row['Rate'] = rate;
    row['Due Date'] = billDate;

    return row;
  };

  const zohoRows: any[] = [];
  faturasFinais.forEach(f => {
    const irpjRow = prepareZohoRow(f, 'IRPJ');
    if (irpjRow) zohoRows.push(irpjRow);

    const csllRow = prepareZohoRow(f, 'CSLL');
    if (csllRow) zohoRows.push(csllRow);
  });

  // A. Planilha de Conferência
  const conferencialRows = faturasFinais.map(f => {
    const {
      InvoiceNumber,
      InvoiceDateFormatted,
      CustomerName,
      Total,
      InvoiceStatus,
      ItemTax,
      ProjectName,
      Equipe,
      ItemTaxAmount,
      percentualContribuicao,
      ...rest
    } = f as any;

    return {
      'Fatura': InvoiceNumber,
      'Data': InvoiceDateFormatted,
      'Cliente': CustomerName,
      'Valor da Fatura': Total,
      ...rest
    };
  });
  const wbConf = XLSX.utils.book_new();
  const sheetConf = XLSX.utils.json_to_sheet(conferencialRows);
  XLSX.utils.book_append_sheet(wbConf, sheetConf, 'Conferência');
  XLSX.writeFile(wbConf, `${dates.periodD}-Relatório de Conferência (CSLL e IRPJ).xlsx`);

  // B. Planilha Carga Zoho
  const wbZoho = XLSX.utils.book_new();
  const sheetZoho = XLSX.utils.json_to_sheet(zohoRows, { header: ZOHO_BILL_HEADERS });
  XLSX.utils.book_append_sheet(wbZoho, sheetZoho, 'Carga Zoho');
  XLSX.writeFile(wbZoho, `${dates.periodD}-Carga Zoho IRPJ e CSLL.xlsx`);
}
