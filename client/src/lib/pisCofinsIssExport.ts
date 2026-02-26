/**
 * Utilitários para exportação de COFINS/PIS e ISS
 * Implementa a lógica de cálculo de impostos e geração de carga ZOHO
 */

import * as XLSX from "xlsx";
import {
  round2,
  parseNumber,
  getVal,
  parseReferenceValue,
  normalizeString,
  findTaxMapping,
  calculateDates,
} from "./taxUtils";

// Alíquotas padrão conforme script R
const ALIQUOTAS = {
  IRPJ: 0.048,
  CSLL: 0.0288,
  COFINS: 0.03,
  PIS: 0.0065,
  ISS: 0.02,
};

/**
 * Extrai overrides de ISS da terceira aba (Alocação/ISS)
 */
function extractIssOverrides(data: any[]): Record<string, number> {
  const overrides: Record<string, number> = {};
  data.forEach(row => {
    const keys = Object.keys(row);
    const cliente = String(
      row["Cliente"] || row["Customer Name"] || row[keys[0]] || ""
    )
      .trim()
      .toUpperCase();

    // Procura por 'ISS' na linha. Se não achar por nome, tenta a 5ª coluna (index 4)
    let rawIss = row["ISS"];
    if (rawIss === undefined || rawIss === "") {
      if (keys.length >= 5) {
        rawIss = row[keys[4]];
      }
    }

    if (cliente && rawIss !== undefined && rawIss !== "") {
      overrides[cliente] = parseReferenceValue(rawIss);
    }
  });
  return overrides;
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
  console.log("[Process] Período alvo:", dates.periodD);

  // 1. Carga de impostos de referência (1ª aba)
  let taxMappings: Record<string, any>[] = [];
  if (allSheets) {
    const firstSheetName = Object.keys(allSheets)[0];
    taxMappings = allSheets[firstSheetName] || [];
  }

  // 1.1 Carga de overrides de ISS (3ª aba)
  let issOverrides: Record<string, number> = {};
  if (allSheets) {
    const sheetNames = Object.keys(allSheets);
    if (sheetNames.length >= 3) {
      const thirdSheetName = sheetNames[2];
      issOverrides = extractIssOverrides(allSheets[thirdSheetName] || []);
    }
  }

  // 2. Processamento de Faturas
  let faturas = invoiceData.map(row => {
    const invoiceDate = String(getVal(row, "Invoice Date") || "");
    const invoiceStatus = String(getVal(row, "Invoice Status") || "");
    const invoiceNumber = String(getVal(row, "Invoice Number") || "");

    return {
      ...row,
      InvoiceDateFormatted: invoiceDate, // Já deve estar em YYYY-MM-DD pelo loader
      InvoiceStatus: invoiceStatus,
      InvoiceNumber: invoiceNumber,
      CustomerName: String(getVal(row, "Customer Name") || ""),
      Total: parseNumber(getVal(row, "Total")),
      ItemTax: String(getVal(row, "Item Tax") || ""),
      ProjectName: String(getVal(row, "Project Name") || ""),
      Equipe: String(getVal(row, "Equipe") || ""),
      ItemTaxAmount: parseNumber(getVal(row, "Item Tax Amount")),
    };
  });

  // Filtros: Apenas Status (Data não filtra mais conforme pedido)
  faturas = faturas.filter(f => {
    const statusMatch =
      f.InvoiceStatus !== "Void" && f.InvoiceStatus !== "Draft";
    return statusMatch;
  });

  console.log(`[Process] ${faturas.length} faturas após filtros`);

  // Merge com impostos retidos
  const faturasComImpostos = faturas.map(f => {
    const retentionPercentage =
      f.Total !== 0 ? (f.ItemTaxAmount * 100) / f.Total : 0;
    const mapping = findTaxMapping(retentionPercentage, taxMappings, f.ItemTax);

    const irpjRet = parseReferenceValue(getVal(mapping || {}, "IRPJ"));
    const csllRet = parseReferenceValue(getVal(mapping || {}, "CSLL"));
    const cofinsRet = parseReferenceValue(getVal(mapping || {}, "COFINS"));
    const pisRet = parseReferenceValue(getVal(mapping || {}, "PIS"));
    const issRet = parseReferenceValue(getVal(mapping || {}, "ISS"));

    if (mapping) {
      console.log(
        `[TaxCalc] NF ${f.InvoiceNumber}: Usando scheme "${getVal(mapping, "Item Tax", "Item Tax1")}" -> IRPJ: ${irpjRet}, CSLL: ${csllRet}, COFINS: ${cofinsRet}, PIS: ${pisRet}, ISS: ${issRet}`
      );
    } else {
      console.warn(
        `[TaxCalc] NF ${f.InvoiceNumber}: NENHUM esquema de tributação encontrado!`
      );
    }

    // Cálculos
    const isItaipuSpecial =
      f.CustomerName === "Itaipu Binacional" &&
      f.ItemTax === "11 | IR 1,5% + CSLL";

    // IRPJ
    const irpjDevido = round2(f.Total * ALIQUOTAS.IRPJ);
    const irpjRetido = round2(f.Total * irpjRet);
    const irpjPendente = irpjDevido - irpjRetido;

    // CSLL
    const csllDevido = round2(f.Total * ALIQUOTAS.CSLL);
    const csllRetido = round2(f.Total * csllRet);
    const csllPendente = csllDevido - csllRetido;

    // COFINS
    const cofinsDevido = isItaipuSpecial
      ? 0
      : round2(f.Total * ALIQUOTAS.COFINS);
    const cofinsRetido = round2(f.Total * cofinsRet);
    const cofinsPendente = cofinsDevido - cofinsRetido;

    // PIS
    const pisDevido = isItaipuSpecial ? 0 : round2(f.Total * ALIQUOTAS.PIS);
    const pisRetido = round2(f.Total * pisRet);
    const pisPendente = pisDevido - pisRetido;

    // ISS (Inicial)
    const clientKey = f.CustomerName.trim().toUpperCase();
    const clientIssOverride = issOverrides[clientKey];
    const issRate =
      clientIssOverride !== undefined ? clientIssOverride : ALIQUOTAS.ISS;

    const issDevido = isItaipuSpecial ? 0 : round2(f.Total * issRate);
    const issRetido = round2(f.Total * issRet);

    return {
      ...f,
      ItemTaxScheme: mapping
        ? String(getVal(mapping, "Item Tax", "Item Tax1") || "")
        : "Não encontrado",
      "IRPJ.devido": irpjDevido,
      "IRPJ.retido": irpjRetido,
      "IRPJ.pendente": irpjPendente,
      "CSLL.devido": csllDevido,
      "CSLL.retido": csllRetido,
      "CSLL.pendente": csllPendente,
      "COFINS.devido": cofinsDevido,
      "COFINS.retido": cofinsRetido,
      "COFINS.pendente": cofinsPendente,
      "PIS.devido": pisDevido,
      "PIS.retido": pisRetido,
      "PIS.pendente": pisPendente,
      "ISS.devido": issDevido,
      "ISS.retido": issRetido,
      "ISS.antecipado": 0, // Será calculado abaixo
    };
  });

  // 3. ISS Antecipado (Cobranças)
  // billData já vem filtrado por " ISS" do hook useInvoiceProcessor
  const cobrancas = billData; // Não filtra por data mais

  // Mapa de InvoiceNumber -> ISS Antecipado
  const issAntecipadoMap: Record<string, number> = {};

  cobrancas.forEach(bill => {
    const billNumber = String(getVal(bill, "Bill Number") || "");
    const rate = parseNumber(getVal(bill, "Rate"));

    // Extrair números (números das notas)
    const matches: string[] = billNumber.match(/\d+/g) || [];

    if (matches.length === 1) {
      const invNum = matches[0];
      issAntecipadoMap[invNum] = (issAntecipadoMap[invNum] || 0) + rate;
    } else if (matches.length > 1) {
      // Split proporcional
      const relatedFaturas = faturasComImpostos.filter(f =>
        matches.includes(f.InvoiceNumber)
      );
      const totalRelated = relatedFaturas.reduce((sum, f) => sum + f.Total, 0);

      if (totalRelated > 0) {
        relatedFaturas.forEach(f => {
          const percentual = f.Total / totalRelated;
          const valorAntecipado = rate * percentual;
          issAntecipadoMap[f.InvoiceNumber] =
            (issAntecipadoMap[f.InvoiceNumber] || 0) + valorAntecipado;
        });
      }
    }
  });

  // Atualizar faturas com ISS antecipado e calcular pendente
  const faturasFinais = faturasComImpostos.map(f => {
    const issAntecipado = round2(issAntecipadoMap[f.InvoiceNumber] || 0);
    const issPendente = f["ISS.devido"] - f["ISS.retido"] - issAntecipado;

    const totalRetido =
      f["IRPJ.retido"] +
      f["CSLL.retido"] +
      f["COFINS.retido"] +
      f["PIS.retido"] +
      f["ISS.retido"];
    const outras = round2(totalRetido - f.ItemTaxAmount);

    return {
      ...f,
      "ISS.antecipado": issAntecipado,
      "ISS.pendente": issPendente,
      "Total.retido": totalRetido,
      Outras: outras,
    };
  });

  return {
    faturasFinais,
    dates,
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
  const { faturasFinais, dates } = processPisCofinsIssData(
    invoiceData,
    billData,
    allSheets
  );

  // 4. Preparar Carga ZOHO (Colunas específicas solicitadas)
  const ZOHO_BILL_HEADERS = [
    "Currency Code",
    "Conta para quitação",
    "Bill Type",
    "Exchange Rate",
    "Quantity",
    "Is Inclusive Tax",
    "Is Billable",
    "Is Landed Cost",
    "Is Discount Before Tax",
    "Bill Status",
    "Discount Type",
    "Bill Number",
    "Account",
    "Description",
    "Customer Name",
    "Project Name",
    "Equipe",
    "Bill Date",
    "Vendor Name",
    "Rate",
    "Due Date",
  ];

  const prepareZohoRow = (entrada: any, tipo: "PIS" | "COFINS" | "ISS") => {
    let rate = 0;
    let billDate = "";
    let vendorName = "";

    if (tipo === "COFINS") {
      rate = entrada["COFINS.pendente"];
      billDate = dates.dataCOFINS;
      vendorName = "RECEITA FEDERAL";
    } else if (tipo === "PIS") {
      rate = entrada["PIS.pendente"];
      billDate = dates.dataPIS;
      vendorName = "RECEITA FEDERAL";
    } else {
      rate = entrada["ISS.pendente"];
      billDate = dates.dataISS;
      vendorName = "PREFEITURA DE VITÓRIA";
    }

    if (round2(rate) === 0) return null;

    const row: Record<string, any> = {};
    ZOHO_BILL_HEADERS.forEach(h => (row[h] = ""));

    row["Currency Code"] = "BRL";
    row["Conta para quitação"] = "Banco do Brasil";
    row["Bill Type"] = "Bill";
    row["Exchange Rate"] = 1;
    row["Quantity"] = 1;
    row["Is Inclusive Tax"] = "false";
    row["Is Billable"] = "false";
    row["Is Landed Cost"] = "false";
    row["Is Discount Before Tax"] = "true";
    row["Bill Status"] = "draft";
    row["Discount Type"] = "entity_level";
    row["Bill Number"] = `${tipo} ${dates.periodD}`;
    row["Account"] = tipo;
    row["Description"] =
      `NF ${entrada.InvoiceNumber} ${entrada.CustomerName} de ${entrada.InvoiceDateFormatted}`;
    row["Customer Name"] = entrada.CustomerName;
    row["Project Name"] = entrada.ProjectName;
    row["Equipe"] = entrada.Equipe;
    row["Bill Date"] = billDate;
    row["Vendor Name"] = vendorName;
    row["Rate"] = rate;
    row["Due Date"] = billDate;

    return row;
  };

  const zohoRows: any[] = [];
  faturasFinais.forEach(f => {
    const pisRow = prepareZohoRow(f, "PIS");
    if (pisRow) zohoRows.push(pisRow);

    const cofinsRow = prepareZohoRow(f, "COFINS");
    if (cofinsRow) zohoRows.push(cofinsRow);

    const issRow = prepareZohoRow(f, "ISS");
    if (issRow) zohoRows.push(issRow);
  });

  // 5. Geração dos arquivos Excel (Separados conforme pedido)

  // A. Planilha de Conferência
  const conferencialRows = faturasFinais.map(f => {
    // Reorganiza e renomeia colunas para o relatório de conferência
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
      ...rest
    } = f as any;

    return {
      Fatura: InvoiceNumber,
      Data: InvoiceDateFormatted,
      Cliente: CustomerName,
      "Valor da Fatura": Total,
      ...rest,
    };
  });
  const wbConf = XLSX.utils.book_new();
  const sheetConf = XLSX.utils.json_to_sheet(conferencialRows);
  XLSX.utils.book_append_sheet(wbConf, sheetConf, "Conferência");
  XLSX.writeFile(wbConf, `${dates.periodD}-Relatório de Conferência.xlsx`);

  // B. Planilha Carga Zoho
  const wbZoho = XLSX.utils.book_new();
  const sheetZoho = XLSX.utils.json_to_sheet(zohoRows, {
    header: ZOHO_BILL_HEADERS,
  });
  XLSX.utils.book_append_sheet(wbZoho, sheetZoho, "Carga Zoho");
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
    const invNumber = String(invoice["Invoice Number"] || "").trim();

    // Procura cobrança correspondente (que contenha o número da fatura)
    const matchedBill = billData.find(bill => {
      const billNumber = String(bill["Bill Number"] || "").toUpperCase();
      return billNumber.includes(invNumber) && invNumber !== "";
    });

    return {
      Fatura: invNumber,
      "Data Fatura": invoice["Invoice Date"],
      Cliente: invoice["Customer Name"],
      "Status Fatura": invoice["Invoice Status"],
      "Total Fatura": invoice["Total"],
      "Imposto Item": invoice["Item Tax Amount"],
      "Cobrança Correspondente": matchedBill
        ? matchedBill["Bill Number"]
        : "Não encontrada",
      "Data Cobrança": matchedBill ? matchedBill["Bill Date"] : "",
      "Total Cobrança": matchedBill ? matchedBill["Total"] : "",
      "Status Cobrança": matchedBill ? matchedBill["Bill Status"] : "",
      Projeto: invoice["Project Name"],
      Equipe: invoice["Equipe"],
    };
  });
}
