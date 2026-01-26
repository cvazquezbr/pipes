/**
 * Utilitários para extração de dados de PDFs de Notas Fiscais (NFS-e)
 * Usa pdfjs-dist para extrair texto e regex patterns para identificar campos
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { ExtractedInvoice } from './types';

// Configurar worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Padrões regex para extração de campos da NFS-e
 * Otimizados para DANFSe (Documento Auxiliar da NFS-e)
 * Nota: Os padrões foram refinados baseado na análise do PDF de teste
 * O layout do DANFSe tem múltiplas quebras de linha entre rótulos e valores
 * Usa [\s\S]+? para capturar qualquer tipo de espaço em branco (\n, espaços, etc)
 */
const EXTRACTION_PATTERNS = {
  // Padrões refinados baseados na análise do PDF DANFSe
  // Usa [\s\S]+? para capturar qualquer espaço em branco (incluindo quebras de linha)
  nfsNumber: /Número da NFS-e[\s\S]+?(\d+)(?=\n)/,
  accessKey: /Chave de Acesso da NFS-e[\s\S]+?([\d]+)(?=\n)/,
  seriesNumber: /Série da DPS[\s\S]+?(\d+)(?=\n)/,
  emissionDate: /Data e Hora de emissão da NFS-e[\s\S]+?(\d{2}\/\d{2}\/\d{4})/,
  emissionTime: /Data e Hora de emissão da DPS[\s\S]+?(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,

  // Emitente - Padrões ajustados para layout do DANFSe
  issuerName: /EMITENTE DA NFS-e[\s\S]*?Nome \/ Nome Empresarial[\s\S]+?([^\n]+?)(?=\n|E-mail)/,
  issuerCNPJ: /EMITENTE DA NFS-e[\s\S]*?CNPJ \/ CPF \/ NIF[\s\S]+?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/,
  issuerAddress: /EMITENTE DA NFS-e[\s\S]*?Endereço[\s\S]+?([^\n]+?)(?=\n|Município)/,
  issuerCity: /EMITENTE DA NFS-e[\s\S]*?Município[\s\S]+?([^\n-]+?)\s*-\s*[A-Z]{2}/,
  issuerState: /EMITENTE DA NFS-e[\s\S]*?Município[\s\S]+?[^\n]+-\s*([A-Z]{2})/,
  issuerCEP: /EMITENTE DA NFS-e[\s\S]*?CEP[\s\S]+?(\d{5}-\d{3})/,
  issuerPhone: /EMITENTE DA NFS-e[\s\S]*?Telefone[\s\S]+?([^\n]+?)(?=\n|CEP)/,
  issuerEmail: /EMITENTE DA NFS-e[\s\S]*?E-mail[\s\S]+?([^\n]+?)(?=\n|Endereço)/,

  // Tomador - Padrões ajustados para layout do DANFSe
  takerName: /TOMADOR DO SERVIÇO[\s\S]*?Nome \/ Nome Empresarial[\s\S]+?([^\n]+?)(?=\n|E-mail)/,
  takerCNPJ: /TOMADOR DO SERVIÇO[\s\S]*?CNPJ \/ CPF \/ NIF[\s\S]+?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/,
  takerAddress: /TOMADOR DO SERVIÇO[\s\S]*?Endereço[\s\S]+?([^\n]+?)(?=\n|Município)/,
  takerCity: /TOMADOR DO SERVIÇO[\s\S]*?Município[\s\S]+?([^\n-]+?)\s*-\s*[A-Z]{2}/,
  takerState: /TOMADOR DO SERVIÇO[\s\S]*?Município[\s\S]+?[^\n]+-\s*([A-Z]{2})/,
  takerCEP: /TOMADOR DO SERVIÇO[\s\S]*?CEP[\s\S]+?(\d{5}-\d{3})/,

  // Serviço
  serviceCode: /Código de Tributação Nacional[\s\S]+?([^\n]+?)(?=\n|Código de Tributação Municipal)/,
  serviceDescription: /Descrição do Serviço[\s\S]+?([\s\S]+?)(?=\n\s*(?:TRIBUTAÇÃO|VALORES|INFORMAÇÕES|$))/,

  // Valores - Padrões para encontrar valores monetários
  serviceValue: /Valor do Serviço[\s\S]+?R\$\s+([\d.,]+)/,
  deductions: /Total Deduções\/Reduções[\s\S]+?R\$\s+([\d.,]+)/,
  irrf: /IRRF[\s\S]+?R\$\s+([\d.,]+)/,
  pis: /PIS[\s\S]+?R\$\s+([\d.,]+)/,
  cofins: /COFINS[\s\S]+?R\$\s+([\d.,]+)/,
  csll: /CSLL[\s\S]+?R\$\s+([\d.,]+)/,
  issqn: /ISSQN[\s\S]+?R\$\s+([\d.,]+)/,
  netValue: /Valor Líquido da NFS-e[\s\S]+?R\$\s+([\d.,]+)/,
};

/**
 * Converte string de valor monetário (R$ 1.234,56) para número em centavos
 */
function parseMonetaryValue(value: string): number {
  if (!value) return 0;
  // Remove "R$", espaços e converte formato brasileiro para número
  const cleaned = value.replace(/R\$\s*/g, '').trim();
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  return Math.round(parseFloat(normalized) * 100);
}

/**
 * Limpa e normaliza strings extraídas
 */
function cleanString(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Extrai texto de um PDF usando pdfjs-dist
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Extrai valor usando padrão regex e aplica processador opcional
 */
function extractValue(
  text: string,
  pattern: RegExp,
  processor?: (value: string) => string | number
): string | number {
  const match = text.match(pattern);
  if (!match || !match[1]) return '';

  const value = cleanString(match[1]);
  return processor ? processor(value) : value;
}

/**
 * Processa texto extraído e retorna dados estruturados
 */
function processExtractedText(text: string, filename: string): ExtractedInvoice {
  const errors: string[] = [];

  const invoice: ExtractedInvoice = {
    // Identificação
    nfsNumber: extractValue(text, EXTRACTION_PATTERNS.nfsNumber) as string,
    accessKey: (extractValue(text, EXTRACTION_PATTERNS.accessKey) as string).replace(/\s+/g, ''),
    seriesNumber: extractValue(text, EXTRACTION_PATTERNS.seriesNumber) as string,

    // Datas
    emissionDate: extractValue(text, EXTRACTION_PATTERNS.emissionDate) as string,
    emissionTime: extractValue(text, EXTRACTION_PATTERNS.emissionTime) as string,

    // Emitente
    issuerName: extractValue(text, EXTRACTION_PATTERNS.issuerName) as string,
    issuerCNPJ: extractValue(text, EXTRACTION_PATTERNS.issuerCNPJ) as string,
    issuerAddress: extractValue(text, EXTRACTION_PATTERNS.issuerAddress) as string,
    issuerCity: extractValue(text, EXTRACTION_PATTERNS.issuerCity) as string,
    issuerState: extractValue(text, EXTRACTION_PATTERNS.issuerState) as string,
    issuerCEP: extractValue(text, EXTRACTION_PATTERNS.issuerCEP) as string,
    issuerPhone: extractValue(text, EXTRACTION_PATTERNS.issuerPhone) as string,
    issuerEmail: extractValue(text, EXTRACTION_PATTERNS.issuerEmail) as string,

    // Tomador
    takerName: extractValue(text, EXTRACTION_PATTERNS.takerName) as string,
    takerCNPJ: extractValue(text, EXTRACTION_PATTERNS.takerCNPJ) as string,
    takerAddress: extractValue(text, EXTRACTION_PATTERNS.takerAddress) as string,
    takerCity: extractValue(text, EXTRACTION_PATTERNS.takerCity) as string,
    takerState: extractValue(text, EXTRACTION_PATTERNS.takerState) as string,
    takerCEP: extractValue(text, EXTRACTION_PATTERNS.takerCEP) as string,

    // Serviço
    serviceCode: extractValue(text, EXTRACTION_PATTERNS.serviceCode) as string,
    serviceDescription: extractValue(text, EXTRACTION_PATTERNS.serviceDescription) as string,

    // Valores
    serviceValue: extractValue(text, EXTRACTION_PATTERNS.serviceValue, parseMonetaryValue) as number,
    deductions: extractValue(text, EXTRACTION_PATTERNS.deductions, parseMonetaryValue) as number,
    irrf: extractValue(text, EXTRACTION_PATTERNS.irrf, parseMonetaryValue) as number,
    pis: extractValue(text, EXTRACTION_PATTERNS.pis, parseMonetaryValue) as number,
    cofins: extractValue(text, EXTRACTION_PATTERNS.cofins, parseMonetaryValue) as number,
    csll: extractValue(text, EXTRACTION_PATTERNS.csll, parseMonetaryValue) as number,
    issqn: extractValue(text, EXTRACTION_PATTERNS.issqn, parseMonetaryValue) as number,
    totalTaxes: 0, // Calculado abaixo
    netValue: extractValue(text, EXTRACTION_PATTERNS.netValue, parseMonetaryValue) as number,

    // Metadados
    filename,
    extractionConfidence: 0.8, // Será ajustado conforme campos preenchidos
    rawText: text,
  };

  // Calcular total de impostos
  invoice.totalTaxes = invoice.irrf + invoice.pis + invoice.cofins + invoice.csll + invoice.issqn;

  // Validar campos essenciais
  const essentialFields = ['nfsNumber', 'accessKey', 'issuerCNPJ', 'takerCNPJ', 'netValue'];
  const filledFields = essentialFields.filter((field) => {
    const value = invoice[field as keyof ExtractedInvoice];
    return value && value !== '';
  });

  invoice.extractionConfidence = filledFields.length / essentialFields.length;

  if (filledFields.length < essentialFields.length) {
    const missingFields = essentialFields.filter((field) => !filledFields.includes(field));
    errors.push(`Campos essenciais não encontrados: ${missingFields.join(', ')}`);
  }

  invoice.extractionErrors = errors;

  return invoice;
}

/**
 * Processa um arquivo PDF e extrai dados da nota fiscal
 */
export async function processPDFInvoice(file: File): Promise<ExtractedInvoice> {
  try {
    const text = await extractTextFromPDF(file);
    return processExtractedText(text, file.name);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      nfsNumber: '',
      accessKey: '',
      seriesNumber: '',
      emissionDate: '',
      emissionTime: '',
      issuerName: '',
      issuerCNPJ: '',
      issuerAddress: '',
      issuerCity: '',
      issuerState: '',
      issuerCEP: '',
      takerName: '',
      takerCNPJ: '',
      takerAddress: '',
      takerCity: '',
      takerState: '',
      takerCEP: '',
      serviceCode: '',
      serviceDescription: '',
      serviceValue: 0,
      deductions: 0,
      irrf: 0,
      pis: 0,
      cofins: 0,
      csll: 0,
      issqn: 0,
      totalTaxes: 0,
      netValue: 0,
      filename: file.name,
      extractionConfidence: 0,
      extractionErrors: [`Erro ao processar PDF: ${errorMessage}`],
    };
  }
}

/**
 * Processa múltiplos PDFs em paralelo
 */
export async function processPDFInvoices(files: File[]): Promise<ExtractedInvoice[]> {
  return Promise.all(files.map((file) => processPDFInvoice(file)));
}
