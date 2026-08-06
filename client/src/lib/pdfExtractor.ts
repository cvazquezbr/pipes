import * as pdfjsLib from "pdfjs-dist";
import type { ExtractedInvoice } from "./types";
import { getExtractionPatterns } from "./extractionPatterns";

// Configurar worker do PDF.js
// Usar versão do npm package diretamente
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/**
 * Converte valor monetário em centavos
 */
function parseMonetaryValue(value: string): number {
  const cleaned = value.replace(/R\$\s*/g, "").trim();
  if (cleaned === "-" || cleaned === "") return 0;

  const parts = cleaned.split(",");

  if (parts.length === 1) {
    const val = parseFloat(parts[0]);
    return isNaN(val) ? 0 : Math.round(val * 100);
  }

  const reais = parts[0].replace(/\./g, "");
  const centavos = parts[1].padEnd(2, "0").substring(0, 2);
  return parseInt(reais + centavos, 10) || 0;
}

/**
 * Normaliza texto do PDF removendo caracteres especiais que parecem espaços
 * Substitui non-breaking spaces, zero-width characters, etc. por espaços normais
 */
function normalizeText(text: string): string {
  // Substituir caracteres especiais que parecem espaços por espaço normal
  let normalized = text
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200C\u200D\u200E\u200F]/g, "")
    .replace(/[\u061C\u180E]/g, " ");

  // Limpar espaços múltiplos
  normalized = normalized.replace(/\s+/g, " ").trim();

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

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  // Normalizar texto
  const text = normalizeText(fullText);

  console.log("[PDF Extractor] Processando arquivo:", file.name);
  console.log(
    "[PDF Extractor] Texto extraido, tamanho:",
    text.length,
    "caracteres"
  );
  console.log(
    "[PDF Extractor] Primeiros 200 caracteres:",
    text.substring(0, 200)
  );

  // Detectar versão do layout DANFSe
  const danfseVersion: "v1" | "v2" = /DANFSe v2/i.test(text) ? "v2" : "v1";
  const patterns = getExtractionPatterns(danfseVersion);

  console.log("[PDF Extractor] Layout detectado:", danfseVersion);

  const invoice: ExtractedInvoice = {
    // Identificação
    nfsNumber:
      (extractValue(text, patterns.nfsNumber) as string) || "",
    accessKey:
      (extractValue(text, patterns.accessKey) as string) || "",
    seriesNumber:
      (extractValue(text, patterns.seriesNumber) as string) || "",

    // Datas
    emissionDate:
      (extractValue(text, patterns.emissionDate) as string) || "",
    emissionTime:
      (extractValue(text, patterns.emissionTime) as string) || "",

    // Emitente
    issuerName:
      (extractValue(text, patterns.issuerName) as string) || "",
    issuerCNPJ:
      (extractValue(text, patterns.issuerCNPJ) as string) || "",
    issuerAddress:
      (extractValue(text, patterns.issuerAddress) as string) || "",
    issuerCity:
      (extractValue(text, patterns.issuerCity) as string) || "",
    issuerState:
      (extractValue(text, patterns.issuerState) as string) || "",
    issuerCEP:
      ((extractValue(text, patterns.issuerCEP) as string) || "").replace(/\./g, ""),
    issuerPhone:
      (extractValue(text, patterns.issuerPhone) as string) || "",
    issuerEmail:
      (extractValue(text, patterns.issuerEmail) as string) || "",

    // Tomador
    takerName:
      (extractValue(text, patterns.takerName) as string) || "",
    takerCNPJ:
      (extractValue(text, patterns.takerCNPJ) as string) || "",
    takerAddress:
      (extractValue(text, patterns.takerAddress) as string) || "",
    takerCity:
      (extractValue(text, patterns.takerCity) as string) || "",
    takerState:
      (extractValue(text, patterns.takerState) as string) || "",
    takerCEP:
      ((extractValue(text, patterns.takerCEP) as string) || "").replace(/\./g, ""),

    // Serviço
    serviceCode:
      (extractValue(text, patterns.serviceCode) as string) || "",
    serviceDescription:
      (extractValue(text, patterns.serviceDescription) as string) ||
      "",

    // Valores
    serviceValue: extractValue(
      text,
      patterns.serviceValue,
      parseMonetaryValue
    ) as number,
    deductions: extractValue(
      text,
      patterns.deductions,
      parseMonetaryValue
    ) as number,
    irrf: extractValue(
      text,
      patterns.irrf,
      parseMonetaryValue
    ) as number,
    cp: extractValue(
      text,
      patterns.cp,
      parseMonetaryValue
    ) as number,
    pis: extractValue(
      text,
      patterns.pis,
      parseMonetaryValue
    ) as number,
    pisRetido: 0, // Calculado abaixo
    pisPendente: 0, // Calculado abaixo
    cofins: extractValue(
      text,
      patterns.cofins,
      parseMonetaryValue
    ) as number,
    cofinsRetido: 0, // Calculado abaixo
    cofinsPendente: 0, // Calculado abaixo
    pisCofinsRetention: (() => {
      if (danfseVersion === "v2") {
        const retentionRaw = extractValue(text, patterns.pisCofinsRetention) as string;
        return retentionRaw && retentionRaw.includes("Não") ? "Não Retido" : (retentionRaw && retentionRaw.includes("Retido") ? "Retido" : "");
      } else {
        return (extractValue(text, patterns.pisCofinsRetention) as string) || "";
      }
    })(),
    csll: extractValue(
      text,
      patterns.csll,
      parseMonetaryValue
    ) as number,
    other: 0, // Calculado abaixo

    // ISSQN - Campos detalhados
    issqnBase: extractValue(
      text,
      patterns.issqnBase,
      parseMonetaryValue
    ) as number,
    issqnApurado: extractValue(
      text,
      patterns.issqnApurado,
      parseMonetaryValue
    ) as number,
    issqnAliquota:
      (extractValue(text, patterns.issqnAliquota) as string) || "",
    issqnSuspensao: danfseVersion === "v2" ? "" : ((extractValue(text, patterns.issqnSuspensao) as string) || ""),
    issqnMunicipio: (() => {
      const match = text.match(patterns.issqnMunicipio);
      if (match && match[1] && match[2]) {
        return `${match[1].trim()} - ${match[2].trim()}`;
      }
      return "";
    })(),
    issqnTributacao:
      (extractValue(text, patterns.issqnTributacao) as string) || "",
    issqnRetido: (() => {
      if (danfseVersion === "v2") {
        const retidoText = extractValue(text, (patterns as any).issqnRetidoText) as string;
        const isRetido = retidoText && retidoText.toLowerCase().includes("retido") && !retidoText.toLowerCase().includes("não");
        return isRetido ? (extractValue(text, patterns.issqnApurado, parseMonetaryValue) as number) : 0;
      } else {
        return extractValue(text, (patterns as any).issqnRetido, parseMonetaryValue) as number;
      }
    })(),

    totalTaxes: 0, // Calculado abaixo
    netValue: extractValue(
      text,
      patterns.netValue,
      parseMonetaryValue
    ) as number,
    isCancelled: (() => {
      const cancelledMatch = extractValue(
        text,
        patterns.cancellation
      );
      const nfsNumber =
        (extractValue(text, patterns.nfsNumber) as string) || "???";
      const isCancelled =
        !!cancelledMatch || file.name.toUpperCase().includes("CANCELADA");
      console.log(
        `[PDF Extractor] NF ${nfsNumber}: isCancelled? ${isCancelled}`,
        cancelledMatch ? `(match: ${cancelledMatch})` : "(filename)"
      );
      return isCancelled;
    })(),

    // IBS / CBS Fields
    ibsCbsCst: danfseVersion === "v2" ? (extractValue(text, (patterns as any).ibsCbsCst) as string || "") : undefined,
    ibsCbsBaseAposReducoes: danfseVersion === "v2" ? (extractValue(text, (patterns as any).ibsCbsBaseAposReducoes, parseMonetaryValue) as number || 0) : undefined,
    ibsAliquotaEfetivaMunicipal: danfseVersion === "v2" ? (extractValue(text, (patterns as any).ibsAliquotaEfetivaMunicipal) as string || "") : undefined,
    ibsValorApuradoMunicipal: danfseVersion === "v2" ? (extractValue(text, (patterns as any).ibsValorApuradoMunicipal, parseMonetaryValue) as number || 0) : undefined,
    ibsAliquotaEfetivaEstadual: danfseVersion === "v2" ? (extractValue(text, (patterns as any).ibsAliquotaEfetivaEstadual) as string || "") : undefined,
    ibsValorApuradoEstadual: danfseVersion === "v2" ? (extractValue(text, (patterns as any).ibsValorApuradoEstadual, parseMonetaryValue) as number || 0) : undefined,
    ibsValorTotalApurado: danfseVersion === "v2" ? (extractValue(text, (patterns as any).ibsValorTotalApurado, parseMonetaryValue) as number || 0) : undefined,
    cbsAliquota: danfseVersion === "v2" ? (extractValue(text, (patterns as any).cbsAliquota) as string || "") : undefined,
    cbsValorTotalApurado: danfseVersion === "v2" ? (extractValue(text, (patterns as any).cbsValorTotalApurado, parseMonetaryValue) as number || 0) : undefined,
    totalIbsCbs: danfseVersion === "v2" ? (extractValue(text, (patterns as any).totalIbsCbs, parseMonetaryValue) as number || 0) : undefined,
    netValueWithIbsCbs: danfseVersion === "v2" ? (extractValue(text, (patterns as any).netValueWithIbsCbs, parseMonetaryValue) as number || 0) : undefined,
    danfseVersion,

    // Metadados
    filename: file.name,
    extractionConfidence: 0.8,
    rawText: text,
  };

  // Calcular deduções e total de impostos: serviceValue - netValue
  invoice.deductions = invoice.serviceValue - invoice.netValue;

  // Calcular PIS/COFINS Retido e Pendente
  const isPisCofinsRetido = invoice.pisCofinsRetention === "Retido";
  invoice.pisRetido = isPisCofinsRetido ? invoice.pis : 0;
  invoice.cofinsRetido = isPisCofinsRetido ? invoice.cofins : 0;
  invoice.pisPendente = invoice.pis - invoice.pisRetido;
  invoice.cofinsPendente = invoice.cofins - invoice.cofinsRetido;

  // Calcular campo 'other' conforme regra:
  // deductions - (issqnRetido + cofins e pis (se retido) + irrf + csll + CP)
  const taxSumForOther =
    invoice.issqnRetido +
    invoice.pisRetido +
    invoice.cofinsRetido +
    invoice.irrf +
    invoice.csll +
    invoice.cp;

  invoice.other = invoice.deductions - taxSumForOther;

  invoice.totalTaxes =
    invoice.irrf +
    invoice.cp +
    invoice.pis +
    invoice.cofins +
    invoice.csll +
    invoice.issqnApurado +
    invoice.issqnRetido;

  // Validar campos essenciais
  const essentialFields = ["nfsNumber", "issuerCNPJ", "takerCNPJ", "netValue"];
  const errors: string[] = [];

  for (const field of essentialFields) {
    const value = invoice[field as keyof ExtractedInvoice];
    if (!value || (typeof value === "number" && value === 0)) {
      errors.push(`Campo essencial "${field}" não foi extraído`);
    }
  }

  if (errors.length > 0) {
    invoice.extractionErrors = errors;
    invoice.extractionConfidence = Math.max(
      0.3,
      invoice.extractionConfidence - 0.2
    );
  }

  console.log("[PDF Extractor] Resultado:", {
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
export async function processPDFInvoices(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<ExtractedInvoice[]> {
  const results: ExtractedInvoice[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      console.log("[NFe] Processando:", file.name);
      const invoice = await extractFromPDF(file);
      results.push(invoice);
    } catch (error) {
      console.error("[NFe] Erro ao processar", file.name, ":", error);
      results.push({
        filename: file.name,
        nfsNumber: "",
        accessKey: "",
        seriesNumber: "",
        emissionDate: "",
        emissionTime: "",
        issuerName: "",
        issuerCNPJ: "",
        issuerAddress: "",
        issuerCity: "",
        issuerState: "",
        issuerCEP: "",
        takerName: "",
        takerCNPJ: "",
        takerAddress: "",
        takerCity: "",
        takerState: "",
        takerCEP: "",
        serviceCode: "",
        serviceDescription: "",
        serviceValue: 0,
        deductions: 0,
        irrf: 0,
        cp: 0,
        pis: 0,
        pisRetido: 0,
        pisPendente: 0,
        cofins: 0,
        cofinsRetido: 0,
        cofinsPendente: 0,
        pisCofinsRetention: "",
        csll: 0,
        other: 0,
        issqnBase: 0,
        issqnApurado: 0,
        issqnAliquota: "",
        issqnSuspensao: "",
        issqnMunicipio: "",
        issqnTributacao: "",
        issqnRetido: 0,
        totalTaxes: 0,
        netValue: 0,
        isCancelled: false,
        extractionConfidence: 0,
        extractionErrors: [
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao processar PDF",
        ],
      });
    }

    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }

  return results;
}
