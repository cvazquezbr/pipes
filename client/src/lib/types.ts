/**
 * Tipos para processamento de Notas Fiscais de Serviço (NFS-e)
 * Estrutura baseada em DANFSe (Documento Auxiliar da NFS-e)
 */

export interface ExtractedInvoice {
  // Identificação
  nfsNumber: string;
  accessKey: string;
  seriesNumber: string;

  // Datas
  emissionDate: string;
  emissionTime: string;

  // Emitente (Prestador de Serviço)
  issuerName: string;
  issuerCNPJ: string;
  issuerAddress: string;
  issuerCity: string;
  issuerState: string;
  issuerCEP: string;
  issuerPhone?: string;
  issuerEmail?: string;

  // Tomador (Cliente)
  takerName: string;
  takerCNPJ: string;
  takerAddress: string;
  takerCity: string;
  takerState: string;
  takerCEP: string;
  takerPhone?: string;
  takerEmail?: string;

  // Serviço
  serviceCode: string;
  serviceDescription: string;

  // Valores (em centavos para precisão)
  serviceValue: number;
  deductions: number;
  irrf: number;
  pis: number;
  cofins: number;
  csll: number;
  
  // ISSQN - Campos detalhados
  issqnBase: number; // Base de Cálculo do ISSQN
  issqnApurado: number; // ISSQN Apurado
  issqnAliquota: string; // Alíquota Aplicada (ex: "5,00%")
  issqnSuspensao: string; // Suspensão da Exigibilidade
  issqnMunicipio: string; // Município de Incidência
  issqnTributacao: string; // Tributação do ISSQN
  issqnCP: number; // CP
  issqnRetido: number; // ISSQN Retido
  
  totalTaxes: number;
  netValue: number;

  // Metadados
  filename: string;
  extractionConfidence: number; // 0-1
  extractionErrors?: string[];
  rawText?: string; // Texto bruto extraído do PDF
}

export interface ProcessingResult {
  invoices: ExtractedInvoice[];
  successCount: number;
  errorCount: number;
  totalProcessed: number;
  errors: ProcessingError[];
}

export interface ProcessingError {
  filename: string;
  error: string;
  timestamp: string;
}

export interface ExcelReferenceData {
  [key: string]: unknown;
}

export interface ExtractionPattern {
  name: string;
  pattern: RegExp;
  group: number;
  processor?: (value: string) => string | number;
}

export interface ZOHOInvoice {
  'Invoice Date': string;
  'Invoice Number': string;
  'Invoice Status': string;
  'Customer Name': string;
  'Template Name': string;
  'Currency Code': string;
  'Exchange Rate': number;
  'SKU': string;
  'Item Desc': string;
  'Quantity': number;
  'Item Price': number;
  'Adjustment': number;
  'Adjustment Description': string;
  'Usage unit': number;
  'Discount': number;
  'Is Inclusive Tax': string;
  'Item Tax1': string;
  'Item Tax1 Type': string;
  'Item Tax1 %': string;
  'Project Name': string;
  'Account': string;
  'Notes': string;
  'Terms & Conditions': string;
}
