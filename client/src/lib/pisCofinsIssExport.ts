/**
 * Utilitários para exportação de COFINS/PIS e ISS
 * Implementa a lógica de cálculo de impostos e geração de carga ZOHO
 */

import * as XLSX from 'xlsx';

// Alíquotas padrão conforme script R
const ALIQUOTAS = {
  IRPJ: 0.048,
  CSLL: 0.0288,
  COFINS: 0.03,
  PIS: 0.0065,
  ISS: 0.02
};

/**
 * Arredondamento padrão para 2 casas decimais (compatível com round2 do R)
 */
function round2(x: number, digits: number = 2): number {
  if (x === undefined || x === null || isNaN(x)) return 0;
  if (Math.abs(x) < 0.0000000001) return 0;
  const factor = Math.pow(10, digits);
  // Usamos Math.sign * Math.round(Math.abs) para garantir arredondamento simétrico (away from zero)
  // que é o comportamento comum em contabilidade e o que o script R parece fazer manualmente
  return Math.sign(x) * Math.round(Math.abs(x) * factor) / factor;
}

/**
 * Converte valor para número, tratando formatos brasileiros
 */
function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value === undefined || value === null || value === '') return 0;

  let str = String(value).trim();
  // Se for uma string vazia após o trim
  if (str === '') return 0;
  // Trata '-' como 0
  if (str === '-') return 0;

  // Remove pontos de milhar e troca vírgula por ponto
  // Formato: 1.234,56 -> 1234.56
  // Mas cuidado para não quebrar se já estiver em formato ponto: 1234.56
  if (str.includes(',') && str.includes('.')) {
    // Possível formato brasileiro: 1.234,56
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato americano com vírgula de milhar: 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Apenas vírgula: 1234,56
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Busca valor em um objeto por múltiplas chaves possíveis (case-insensitive e flexível com separadores)
 */
function getVal(row: Record<string, unknown>, ...keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key];

    const normalizedTarget = key.toLowerCase().replace(/[._\s]/g, '');
    for (const rowKey of Object.keys(row)) {
      const normalizedRowKey = rowKey.toLowerCase().replace(/[._\s]/g, '');
      if (normalizedRowKey === normalizedTarget && row[rowKey] !== undefined && row[rowKey] !== '') {
        return row[rowKey];
      }
    }
  }
  return undefined;
}

/**
 * Calcula período alvo e datas de vencimento
 */
function calculateDates() {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() - 20);

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1; // 1-12
  const monthStr = String(month).padStart(2, '0');
  const periodD = `${year}-${monthStr}`;

  // Datas de pagamento (mês seguinte ao alvo)
  const nextMonthDate = new Date(year, month, 1); // JS Date: month 0-11, so passing 'month' gives next month
  const nextYear = nextMonthDate.getFullYear();
  const nextMonth = nextMonthDate.getMonth() + 1;
  const nextMonthStr = String(nextMonth).padStart(2, '0');

  return {
    periodD,
    dataCOFINS: `24/${nextMonthStr}/${nextYear}`,
    dataPIS: `24/${nextMonthStr}/${nextYear}`,
    dataISS: `19/${nextMonthStr}/${nextYear}`,
    year,
    monthStr
  };
}

/**
 * Converte valor da planilha de referência para número (porcentagem)
 */
function parseReferenceValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value === undefined || value === null || value === '') return 0;

  const str = String(value).trim();
  const cleaned = str.replace('%', '').replace(/\s/g, '');

  if (cleaned.includes(',')) {
    if (cleaned.includes('.')) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(cleaned.replace(',', '.')) || 0;
  }

  return parseFloat(cleaned) || 0;
}

/**
 * Tenta obter o percentual de uma linha de mapeamento
 */
function getMappingPercentage(mapping: any): number {
  const rawPercent = mapping['Item Tax1 %_1'] !== undefined && mapping['Item Tax1 %_1'] !== ''
    ? mapping['Item Tax1 %_1']
    : mapping['Item Tax1 %2'] !== undefined && mapping['Item Tax1 %2'] !== ''
      ? mapping['Item Tax1 %2']
      : mapping['Item Tax1 %'];

  return parseReferenceValue(rawPercent);
}

/**
 * Encontra o mapeamento de imposto mais próximo
 */
function findTaxMapping(
  retentionPercentage: number,
  taxMappings: any[],
  itemTaxName: string
): any {
  if (taxMappings.length === 0) return null;

  // 1. Tenta por nome primeiro
  const nameMatch = taxMappings.find(m => {
    const mName = String(getVal(m, 'Item Tax', 'Item Tax1') || '').trim();
    return mName.toLowerCase() === itemTaxName.trim().toLowerCase();
  });
  if (nameMatch) return nameMatch;

  // 2. Fallback para percentual
  return taxMappings.reduce((prev, curr) => {
    let currPercent = getMappingPercentage(curr);
    let prevPercent = getMappingPercentage(prev);

    // Normalização básica: se o percentual da planilha for fracionário (ex: 0.0615)
    // e o calculado for percentual (6.15), ajustamos para comparação
    if (currPercent < 1 && retentionPercentage > 1) currPercent *= 100;
    if (prevPercent < 1 && retentionPercentage > 1) prevPercent *= 100;

    return Math.abs(currPercent - retentionPercentage) < Math.abs(prevPercent - retentionPercentage)
      ? curr
      : prev;
  });
}

/**
 * Processa dados de faturamento e cobrança seguindo a lógica do script R e requisitos do usuário
 */
export function processPisCofinsIssData(
  invoiceData: Record<string, unknown>[],
  billData: Record<string, unknown>[],
  allSheets: Record<string, Record<string, unknown>[]> | null = null
) {
  const dates = calculateDates();
  console.log('[Process] Período alvo:', dates.periodD);

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
      InvoiceDateFormatted: invoiceDate, // Já deve estar em YYYY-MM-DD pelo loader
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

  // Filtros: Apenas Status (Data não filtra mais conforme pedido)
  faturas = faturas.filter(f => {
    const statusMatch = f.InvoiceStatus !== 'Void' && f.InvoiceStatus !== 'Draft';
    return statusMatch;
  });

  console.log(`[Process] ${faturas.length} faturas após filtros`);

  // Merge com impostos retidos
  const faturasComImpostos = faturas.map(f => {
    const retentionPercentage = f.Total !== 0 ? (f.ItemTaxAmount * 100) / f.Total : 0;
    const mapping = findTaxMapping(retentionPercentage, taxMappings, f.ItemTax);

    const irpjRet = parseReferenceValue(getVal(mapping || {}, 'IRPJ'));
    const csllRet = parseReferenceValue(getVal(mapping || {}, 'CSLL'));
    const cofinsRet = parseReferenceValue(getVal(mapping || {}, 'COFINS'));
    const pisRet = parseReferenceValue(getVal(mapping || {}, 'PIS'));
    const issRet = parseReferenceValue(getVal(mapping || {}, 'ISS'));

    // Cálculos
    const isItaipuSpecial = f.CustomerName === 'Itaipu Binacional' && f.ItemTax === '11 | IR 1,5% + CSLL';

    // IRPJ
    const irpjDevido = round2(f.Total * ALIQUOTAS.IRPJ);
    const irpjRetido = round2(f.Total * irpjRet);
    const irpjPendente = irpjDevido - irpjRetido;

    // CSLL
    const csllDevido = round2(f.Total * ALIQUOTAS.CSLL);
    const csllRetido = round2(f.Total * csllRet);
    const csllPendente = csllDevido - csllRetido;

    // COFINS
    const cofinsDevido = isItaipuSpecial ? 0 : round2(f.Total * ALIQUOTAS.COFINS);
    const cofinsRetido = round2(f.Total * cofinsRet);
    const cofinsPendente = cofinsDevido - cofinsRetido;

    // PIS
    const pisDevido = isItaipuSpecial ? 0 : round2(f.Total * ALIQUOTAS.PIS);
    const pisRetido = round2(f.Total * pisRet);
    const pisPendente = pisDevido - pisRetido;

    // ISS (Inicial)
    const issDevido = isItaipuSpecial ? 0 : round2(f.Total * ALIQUOTAS.ISS);
    const issRetido = round2(f.Total * issRet);

    return {
      ...f,
      'IRPJ.devido': irpjDevido,
      'IRPJ.retido': irpjRetido,
      'IRPJ.pendente': irpjPendente,
      'CSLL.devido': csllDevido,
      'CSLL.retido': csllRetido,
      'CSLL.pendente': csllPendente,
      'COFINS.devido': cofinsDevido,
      'COFINS.retido': cofinsRetido,
      'COFINS.pendente': cofinsPendente,
      'PIS.devido': pisDevido,
      'PIS.retido': pisRetido,
      'PIS.pendente': pisPendente,
      'ISS.devido': issDevido,
      'ISS.retido': issRetido,
      'ISS.antecipado': 0, // Será calculado abaixo
    };
  });

  // 3. ISS Antecipado (Cobranças)
  // billData já vem filtrado por " ISS" do hook useInvoiceProcessor
  const cobrancas = billData; // Não filtra por data mais

  // Mapa de InvoiceNumber -> ISS Antecipado
  const issAntecipadoMap: Record<string, number> = {};

  cobrancas.forEach(bill => {
    const billNumber = String(getVal(bill, 'Bill Number') || '');
    const rate = parseNumber(getVal(bill, 'Rate'));

    // Extrair números (números das notas)
    const matches = billNumber.match(/\d+/g) || [];

    if (matches.length === 1) {
      const invNum = matches[0];
      issAntecipadoMap[invNum] = (issAntecipadoMap[invNum] || 0) + rate;
    } else if (matches.length > 1) {
      // Split proporcional
      const relatedFaturas = faturasComImpostos.filter(f => matches.includes(f.InvoiceNumber));
      const totalRelated = relatedFaturas.reduce((sum, f) => sum + f.Total, 0);

      if (totalRelated > 0) {
        relatedFaturas.forEach(f => {
          const percentual = f.Total / totalRelated;
          const valorAntecipado = rate * percentual;
          issAntecipadoMap[f.InvoiceNumber] = (issAntecipadoMap[f.InvoiceNumber] || 0) + valorAntecipado;
        });
      }
    }
  });

  // Atualizar faturas com ISS antecipado e calcular pendente
  const faturasFinais = faturasComImpostos.map(f => {
    const issAntecipado = round2(issAntecipadoMap[f.InvoiceNumber] || 0);
    const issPendente = f['ISS.devido'] - f['ISS.retido'] - issAntecipado;

    const totalRetido = f['IRPJ.retido'] + f['CSLL.retido'] + f['COFINS.retido'] + f['PIS.retido'] + f['ISS.retido'];
    const outras = round2(totalRetido - f.ItemTaxAmount);

    return {
      ...f,
      'ISS.antecipado': issAntecipado,
      'ISS.pendente': issPendente,
      'Total.retido': totalRetido,
      'Outras': outras
    };
  });

  return {
    faturasFinais,
    dates
  };
}

/**
 * Exporta dados de faturamento e cobrança para Excel seguindo a lógica do script R
 */
export function exportPisCofinsIssExcel(
  invoiceData: Record<string, unknown>[],
  billData: Record<string, unknown>[],
  allSheets: Record<string, Record<string, unknown>[]> | null = null
): void {
  const { faturasFinais, dates } = processPisCofinsIssData(invoiceData, billData, allSheets);

  // 4. Preparar Carga ZOHO (Colunas específicas solicitadas)
  const ZOHO_BILL_HEADERS = [
    'Bill Date', 'Due Date', 'Bill ID', 'Vendor Name', 'Entity Discount Percent',
    'Payment Terms', 'Payment Terms Label', 'Bill Number', 'PurchaseOrder',
    'Currency Code', 'Exchange Rate', 'SubTotal', 'Total', 'Balance',
    'TotalRetentionAmountFCY', 'TotalRetentionAmountBCY', 'Vendor Notes',
    'Terms & Conditions', 'Adjustment', 'Adjustment Description', 'Bill Type',
    'Is Inclusive Tax', 'Submitted By', 'Approved By', 'Submitted Date',
    'Approved Date', 'Bill Status', 'Created By', 'Product ID', 'Item Name',
    'Account', 'Account Code', 'Description', 'Quantity', 'Tax Amount',
    'Item Total', 'Is Billable', 'Rate', 'Discount Type', 'Is Discount Before Tax',
    'Discount', 'Discount Amount', 'Purchase Order Number', 'Tax ID', 'Tax Name',
    'Tax Percentage', 'Tax Type', 'Entity Discount Amount', 'Discount Account',
    'Discount Account Code', 'Item Discount Account', 'Item Discount Account Code',
    'Is Landed Cost', 'Customer Name', 'Project Name', 'Equipe',
    'CF.Conta para quitação', 'CF.Link no SVN'
  ];

  const prepareZohoRow = (entrada: any, tipo: 'PIS' | 'COFINS' | 'ISS') => {
    let rate = 0;
    let billDate = '';
    let vendorName = '';

    if (tipo === 'COFINS') {
      rate = entrada['COFINS.pendente'];
      billDate = dates.dataCOFINS;
      vendorName = 'RECEITA FEDERAL';
    } else if (tipo === 'PIS') {
      rate = entrada['PIS.pendente'];
      billDate = dates.dataPIS;
      vendorName = 'RECEITA FEDERAL';
    } else {
      rate = entrada['ISS.pendente'];
      billDate = dates.dataISS;
      vendorName = 'PREFEITURA DE VITÓRIA';
    }

    if (round2(rate) === 0) return null;

    const row: Record<string, any> = {};
    ZOHO_BILL_HEADERS.forEach(h => row[h] = '');

    row['Bill Date'] = billDate;
    row['Due Date'] = billDate;
    row['Vendor Name'] = vendorName;
    row['Bill Number'] = `${tipo} ${dates.periodD}`;
    row['Currency Code'] = 'BRL';
    row['Exchange Rate'] = 1;
    row['SubTotal'] = rate;
    row['Total'] = rate;
    row['Balance'] = rate;
    row['Bill Type'] = 'Bill';
    row['Is Inclusive Tax'] = 'false';
    row['Bill Status'] = 'draft';
    row['Account'] = tipo;
    row['Description'] = `NF ${entrada.InvoiceNumber} ${entrada.CustomerName} de ${entrada.InvoiceDateFormatted}`;
    row['Quantity'] = 1;
    row['Rate'] = rate;
    row['Item Total'] = rate;
    row['Is Billable'] = 'false';
    row['Is Discount Before Tax'] = 'true';
    row['Discount Type'] = 'entity_level';
    row['Is Landed Cost'] = 'false';
    row['Customer Name'] = entrada.CustomerName;
    row['Project Name'] = entrada.ProjectName;
    row['Equipe'] = entrada.Equipe;
    row['CF.Conta para quitação'] = 'Banco do Brasil';

    return row;
  };

  const zohoRows: any[] = [];
  faturasFinais.forEach(f => {
    const pisRow = prepareZohoRow(f, 'PIS');
    if (pisRow) zohoRows.push(pisRow);

    const cofinsRow = prepareZohoRow(f, 'COFINS');
    if (cofinsRow) zohoRows.push(cofinsRow);

    const issRow = prepareZohoRow(f, 'ISS');
    if (issRow) zohoRows.push(issRow);
  });

  // 5. Geração dos arquivos Excel (Separados conforme pedido)

  // A. Planilha de Conferência
  const conferencialRows = faturasFinais.map(f => {
    const newRow = { ...f };
    delete (newRow as any).InvoiceDateFormatted;
    delete (newRow as any).InvoiceStatus;
    delete (newRow as any).InvoiceNumber;
    delete (newRow as any).CustomerName;
    delete (newRow as any).Total;
    delete (newRow as any).ItemTax;
    delete (newRow as any).ProjectName;
    delete (newRow as any).Equipe;
    delete (newRow as any).ItemTaxAmount;
    return newRow;
  });
  const wbConf = XLSX.utils.book_new();
  const sheetConf = XLSX.utils.json_to_sheet(conferencialRows);
  XLSX.utils.book_append_sheet(wbConf, sheetConf, 'Conferência');
  XLSX.writeFile(wbConf, `${dates.periodD}-Relatório de Conferência.xlsx`);

  // B. Planilha Carga Zoho
  const wbZoho = XLSX.utils.book_new();
  const sheetZoho = XLSX.utils.json_to_sheet(zohoRows, { header: ZOHO_BILL_HEADERS });
  XLSX.utils.book_append_sheet(wbZoho, sheetZoho, 'Carga Zoho');
  XLSX.writeFile(wbZoho, `${dates.periodD}-Carga Zoho ISS, COFINS e PIS.xlsx`);
}

/**
 * Tenta cruzar faturas com cobranças (Legado/Auxiliar)
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
