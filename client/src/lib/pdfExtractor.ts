import * as pdfjsLib from 'pdfjs-dist';
import type { ExtractedInvoice } from './types';

// Configurar worker do PDF.js
// Usar versão do npm package diretamente
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Padrões regex para extração de campos da NFS-e
 * Otimizados para DANFSe (Documento Auxiliar da NFS-e)
 * Após normalização de espaçamento
 */
const EXTRACTION_PATTERNS = {
  // Identificação
  nfsNumber: /Número da NFS-e[\s\S]+?(\d+)(?=[\s\n]|$)/,
  seriesNumber: /Série da DPS[\s\S]+?(\d+)(?=[\s\n]|$)/,
  emissionDate: /Data e Hora da emissão da NFS-e[\s\S]+?(\d{2}\/\d{2}\/\d{4})/,
  emissionTime: /Data e Hora da emissão da NFS-e[\s\S]+?\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2}:\d{2})/,

  // Emitente
  issuerName: /EMITENTE DA NFS-e[\s\S]*?Nome \/ Nome Empresarial[\s\S]+?([^\n]+?)(?=\n|E-mail)/,
  issuerCNPJ: /EMITENTE DA NFS-e[\s\S]*?CNPJ \/ CPF \/ NIF[\s\S]+?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/,
  issuerAddress: /EMITENTE DA NFS-e[\s\S]*?Endereço[\s\S]+?([^\n]+?)(?=\n|Município)/,
  issuerCity: /EMITENTE DA NFS-e[\s\S]*?Município[\s\S]+?([^\n-]+?)\s*-\s*[A-Z]{2}/,
  issuerState: /EMITENTE DA NFS-e[\s\S]*?Município[\s\S]+?-\s*([A-Z]{2})/,
  issuerCEP: /EMITENTE DA NFS-e[\s\S]*?CEP[\s\S]+?(\d{5}-\d{3})/,
  issuerPhone: /Telefone[\s\S]+?(\([\d\s]+\)[\d\s-]+?)(?=\n|Nome|E-mail|Endereço)/,
  issuerEmail: /EMITENTE DA NFS-e[\s\S]*?E-mail[\s\S]+?([^\n]+?)(?=\n|Endereco)/,

  // Tomador
  takerName: /TOMADOR DO SERVIÇO[\s\S]*?Nome \/ Nome Empresarial[\s\S]+?([^\n]+?)(?=\n|E-mail)/,
  takerCNPJ: /TOMADOR DO SERVIÇO[\s\S]*?CNPJ \/ CPF \/ NIF[\s\S]+?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/,
  takerAddress: /TOMADOR DO SERVIÇO[\s\S]*?Endereço[\s\S]+?([^\n]+?)(?=\n|Município)/,
  takerCity: /TOMADOR DO SERVIÇO[\s\S]*?Município[\s\S]+?([^\n-]+?)\s*-\s*[A-Z]{2}/,
  takerState: /TOMADOR DO SERVIÇO[\s\S]*?Município[\s\S]+?-\s*([A-Z]{2})/,
  takerCEP: /TOMADOR DO SERVIÇO[\s\S]*?CEP[\s\S]+?(\d{5}-\d{3})/,

  // Serviço
  serviceCode: /Código de Tributação Nacional[\s\S]+?([^\n]+?)(?=\n|Código de Tributação Municipal)/,
  serviceDescription: /Descrição do Serviço[\s\S]+?([\s\S]+?)(?=TRIBUTAÇÃO MUNICIPAL)/,

  // Valores
  serviceValue: /Valor do Serviço[\s\S]+?R\$\s+([\d.,]+)/,
  deductions: /Total Deduções\/Reduções[\s\S]+?R\$\s+([\d.,]+)(?=\s|\n)/,
  irrf: /IRRF[\s\S]+?R\$\s+([\d.,]+)/,
  pis: /PIS[\s\S]+?R\$\s+([\d.,]+)/,
  cofins: /COFINS[\s\S]+?R\$\s+([\d.,]+)/,
  csll: /CSLL[\s\S]+?R\$\s+([\d.,]+)/,
  
  // ISSQN - Campos detalhados
  issqnBase: /Base de Cálculo do ISSQN[\s\S]+?R\$\s+([\d.,]+)/,
  issqnApurado: /ISSQN Apurado[\s\S]+?R\$\s+([\d.,]+)/,
  issqnAliquota: /Alíquota Aplicada[\s\S]+?(\d+[.,]\d{2}%)/,
  issqnSuspensao: /Suspensão da Exigibilidade do ISSQN[\s\S]+?(Sim|Não)(?=\s|\n)/,
  issqnMunicipio: /Município de Incidência do ISSQN[\s\S]+?([^\n-]+?)\s*-\s*([A-Z]{2})(?=\s|\n)/,
  issqnTributacao: /Tributação do ISSQN[\s\S]+?(Tributável|Não Tributável|Imune)(?=\s|\n)/,
  issqnCP: /Retenção do ISSQN[\s\S]+?(?:Retido pelo Tomador)?[\s\S]+?R\$\s+([\d.,]+)/,
  issqnRetido: /ISSQN Retido[\s\S]+?R\$\s+([\d.,]+)/,
  
  netValue: /Valor Líquido da NFS-e[\s\S]+?R\$\s+([\d.,]+)/,
};

/**
 * Converte valor monetário em centavos
 */
function parseMonetaryValue(value: string): number {
  const cleaned = value.replace(/R\$\s*/g, '').trim();
  const parts = cleaned.split(',');
  
  if (parts.length === 1) {
    return Math.round(parseFloat(parts[0]) * 100);
  }
  
  const reais = parts[0].replace(/\./g, '');
  const centavos = parts[1].padEnd(2, '0').substring(0, 2);
  return parseInt(reais + centavos, 10);
}

/**
 * Normaliza texto do PDF removendo caracteres especiais que parecem espaços
 * Substitui non-breaking spaces, zero-width characters, etc. por espaços normais
 */
function normalizeText(text: string): string {
  // Substituir caracteres especiais que parecem espaços por espaço normal
  let normalized = text
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u200C\u200D\u200E\u200F]/g, '')
    .replace(/[\u061C\u180E]/g, ' ');
  
  // Limpar espaços múltiplos
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Extrai valor usando padrão regex
 */
function extractValue(
  text: string,
  pattern: RegExp,
  processor?: (value: string) => string | number
): string | number | null {
  const match = text.match(pattern);
  if (!match || !match[1]) {
    return null;
  }
  
  const value = match[1].trim();
  return processor ? processor(value) : value;
}

/**
 * Processa um arquivo PDF e extrai dados da NFS-e
 */
async function extractFromPDF(file: File): Promise<ExtractedInvoice> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  // Normalizar texto
  const text = normalizeText(fullText);
  
  console.log('[PDF Extractor] Processando arquivo:', file.name);
  console.log('[PDF Extractor] Texto extraido, tamanho:', text.length, 'caracteres');
  console.log('[PDF Extractor] Primeiros 200 caracteres:', text.substring(0, 200));
  
  const invoice: ExtractedInvoice = {
    // Identificação
    nfsNumber: (extractValue(text, EXTRACTION_PATTERNS.nfsNumber) as string) || '',
    accessKey: '',
    seriesNumber: (extractValue(text, EXTRACTION_PATTERNS.seriesNumber) as string) || '',

    // Datas
    emissionDate: (extractValue(text, EXTRACTION_PATTERNS.emissionDate) as string) || '',
    emissionTime: (extractValue(text, EXTRACTION_PATTERNS.emissionTime) as string) || '',

    // Emitente
    issuerName: (extractValue(text, EXTRACTION_PATTERNS.issuerName) as string) || '',
    issuerCNPJ: (extractValue(text, EXTRACTION_PATTERNS.issuerCNPJ) as string) || '',
    issuerAddress: (extractValue(text, EXTRACTION_PATTERNS.issuerAddress) as string) || '',
    issuerCity: (extractValue(text, EXTRACTION_PATTERNS.issuerCity) as string) || '',
    issuerState: (extractValue(text, EXTRACTION_PATTERNS.issuerState) as string) || '',
    issuerCEP: (extractValue(text, EXTRACTION_PATTERNS.issuerCEP) as string) || '',
    issuerPhone: (extractValue(text, EXTRACTION_PATTERNS.issuerPhone) as string) || '',
    issuerEmail: (extractValue(text, EXTRACTION_PATTERNS.issuerEmail) as string) || '',

    // Tomador
    takerName: (extractValue(text, EXTRACTION_PATTERNS.takerName) as string) || '',
    takerCNPJ: (extractValue(text, EXTRACTION_PATTERNS.takerCNPJ) as string) || '',
    takerAddress: (extractValue(text, EXTRACTION_PATTERNS.takerAddress) as string) || '',
    takerCity: (extractValue(text, EXTRACTION_PATTERNS.takerCity) as string) || '',
    takerState: (extractValue(text, EXTRACTION_PATTERNS.takerState) as string) || '',
    takerCEP: (extractValue(text, EXTRACTION_PATTERNS.takerCEP) as string) || '',

    // Serviço
    serviceCode: (extractValue(text, EXTRACTION_PATTERNS.serviceCode) as string) || '',
    serviceDescription: (extractValue(text, EXTRACTION_PATTERNS.serviceDescription) as string) || '',

    // Valores
    serviceValue: extractValue(text, EXTRACTION_PATTERNS.serviceValue, parseMonetaryValue) as number,
    deductions: extractValue(text, EXTRACTION_PATTERNS.deductions, parseMonetaryValue) as number,
    irrf: extractValue(text, EXTRACTION_PATTERNS.irrf, parseMonetaryValue) as number,
    pis: extractValue(text, EXTRACTION_PATTERNS.pis, parseMonetaryValue) as number,
    cofins: extractValue(text, EXTRACTION_PATTERNS.cofins, parseMonetaryValue) as number,
    csll: extractValue(text, EXTRACTION_PATTERNS.csll, parseMonetaryValue) as number,
    
    // ISSQN - Campos detalhados
    issqnBase: extractValue(text, EXTRACTION_PATTERNS.issqnBase, parseMonetaryValue) as number,
    issqnApurado: extractValue(text, EXTRACTION_PATTERNS.issqnApurado, parseMonetaryValue) as number,
    issqnAliquota: (extractValue(text, EXTRACTION_PATTERNS.issqnAliquota) as string) || '',
    issqnSuspensao: (extractValue(text, EXTRACTION_PATTERNS.issqnSuspensao) as string) || '',
    issqnMunicipio: (() => {
      const match = text.match(EXTRACTION_PATTERNS.issqnMunicipio);
      if (match && match[1] && match[2]) {
        return `${match[1].trim()} - ${match[2]}`;
      }
      return '';
    })(),
    issqnTributacao: (extractValue(text, EXTRACTION_PATTERNS.issqnTributacao) as string) || '',
    issqnCP: extractValue(text, EXTRACTION_PATTERNS.issqnCP, parseMonetaryValue) as number,
    issqnRetido: extractValue(text, EXTRACTION_PATTERNS.issqnRetido, parseMonetaryValue) as number,
    
    totalTaxes: 0, // Calculado abaixo
    netValue: extractValue(text, EXTRACTION_PATTERNS.netValue, parseMonetaryValue) as number,

    // Metadados
    filename: file.name,
    extractionConfidence: 0.8,
    rawText: text,
  };

  // Calcular total de impostos: serviceValue - netValue
  invoice.totalTaxes = invoice.serviceValue - invoice.netValue;

  // Validar campos essenciais
  const essentialFields = ['nfsNumber', 'issuerCNPJ', 'takerCNPJ', 'netValue'];
  const errors: string[] = [];
  
  for (const field of essentialFields) {
    const value = invoice[field as keyof ExtractedInvoice];
    if (!value || (typeof value === 'number' && value === 0)) {
      errors.push(`Campo essencial "${field}" não foi extraído`);
    }
  }

  if (errors.length > 0) {
    invoice.extractionErrors = errors;
    invoice.extractionConfidence = Math.max(0.3, invoice.extractionConfidence - 0.2);
  }

  console.log('[PDF Extractor] Resultado:', {
    nfsNumber: invoice.nfsNumber,
    issuerCNPJ: invoice.issuerCNPJ,
    takerCNPJ: invoice.takerCNPJ,
    netValue: invoice.netValue,
    issqnApurado: invoice.issqnApurado,
    issqnAliquota: invoice.issqnAliquota,
  });

  return invoice;
}

/**
 * Processa múltiplos PDFs (sequencial)
 */
export async function processPDFInvoices(files: File[]): Promise<ExtractedInvoice[]> {
  const results: ExtractedInvoice[] = [];

  for (const file of files) {
    try {
      console.log('[NFe] Processando:', file.name);
      const invoice = await extractFromPDF(file);
      results.push(invoice);
    } catch (error) {
      console.error('[NFe] Erro ao processar', file.name, ':', error);
      results.push({
        filename: file.name,
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
        issqnBase: 0,
        issqnApurado: 0,
        issqnAliquota: '',
        issqnSuspensao: '',
        issqnMunicipio: '',
        issqnTributacao: '',
        issqnCP: 0,
        issqnRetido: 0,
        totalTaxes: 0,
        netValue: 0,
        extractionConfidence: 0,
        extractionErrors: [error instanceof Error ? error.message : 'Erro desconhecido ao processar PDF'],
      });
    }
  }

  return results;
}
