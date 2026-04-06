import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import * as XLSX from "xlsx";
import { PDFDocument } from "pdf-lib";

// Configurar worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export interface WorkerData {
  cpf: string;
  nome: string;
  email: string;
}

export interface Critica {
  tipo: "erro" | "alerta" | "sucesso";
  mensagem: string;
  dia?: string;
}

export interface FolhaPontoResult {
  cpf: string;
  nome: string;
  email: string;
  matchStatus: "encontrado" | "nao_encontrado" | "folha_ausente" | "cpf_extra";
  criticas: Critica[];
  pdfBuffer?: Uint8Array;
  paginas: number[];
  rawText: string;
}

export interface ProcessingOptions {
  horasAdicionaisLimite: number;
}

/**
 * Normaliza texto do PDF
 */
function normalizeText(text: string): string {
  return text
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converte string de horas (HH:mm) para minutos
 */
function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(":")) return 0;
  const sign = timeStr.startsWith("-") ? -1 : 1;
  const [hours, minutes] = timeStr.replace("-", "").split(":").map(Number);
  return sign * (hours * 60 + (minutes || 0));
}

/**
 * Parse da planilha de trabalhadores
 */
export async function parseWorkersExcel(file: File): Promise<WorkerData[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

  return jsonData.map(row => {
    // Tenta encontrar colunas por nome ou posição
    const nome = row["Nome"] || row["NOME"] || Object.values(row)[0];
    const email = row["E-mail"] || row["Email"] || row["EMAIL"] || Object.values(row)[1];
    const cpf = String(row["CPF"] || row["Cpf"] || row["cpf"] || Object.values(row).slice(-1)[0]);

    return {
      nome: String(nome || ""),
      email: String(email || ""),
      cpf: cpf.replace(/\D/g, ""), // Normaliza apenas números
    };
  });
}

/**
 * Processa o PDF único e cruza com a base de funcionários
 */
export async function processFolhaPonto(
  pdfFile: File,
  workers: WorkerData[],
  options: ProcessingOptions,
  onProgress?: (p: number) => void
): Promise<FolhaPontoResult[]> {
  const arrayBuffer = await pdfFile.arrayBuffer();
  // Usamos slice(0) para evitar que o buffer seja desvinculado (detached)
  // ao ser passado para os processadores de PDF
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const originalPdfLibDoc = await PDFDocument.load(arrayBuffer.slice(0));

  const resultsMap = new Map<string, FolhaPontoResult>();

  // Inicializa resultados com base na planilha (Left Join)
  workers.forEach(w => {
    resultsMap.set(w.cpf, {
      cpf: w.cpf,
      nome: w.nome,
      email: w.email,
      matchStatus: "folha_ausente",
      criticas: [],
      paginas: [],
      rawText: ""
    });
  });

  const totalPages = pdfDoc.numPages;

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageRawText = textContent.items.map((item: any) => item.str).join(" ");
    const text = normalizeText(pageRawText);

    // Localizar CPF (000.000.000-00 ou similar)
    const cpfMatch = text.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
    let cpf = cpfMatch ? cpfMatch[1].replace(/\D/g, "") : null;

    if (cpf) {
      let result = resultsMap.get(cpf);
      if (!result) {
        // CPF no PDF que não está na planilha
        result = {
          cpf,
          nome: "Desconhecido (PDF)",
          email: "",
          matchStatus: "cpf_extra",
          criticas: [],
          paginas: [],
          rawText: ""
        };
        resultsMap.set(cpf, result);
      } else {
        result.matchStatus = "encontrado";
      }

      result.paginas.push(i - 1);
      result.rawText += (result.rawText ? "\n\n" : "") + `PÁGINA ${i}:\n` + text;

      // Análise de Críticas na página
      const criticas = analyzePageCriticas(text, options);
      result.criticas.push(...criticas);
    }

    if (onProgress) onProgress(Math.round((i / totalPages) * 100));
  }

  const finalResults = Array.from(resultsMap.values());

  // Gerar sub-PDFs para cada funcionário que tem páginas
  for (const res of finalResults) {
    if (res.paginas.length > 0) {
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(originalPdfLibDoc, res.paginas);
      copiedPages.forEach(p => newDoc.addPage(p));
      res.pdfBuffer = await newDoc.save();
    }
  }

  return finalResults;
}

export function analyzePageCriticas(text: string, options: ProcessingOptions): Critica[] {
  const criticas: Critica[] = [];
  // Regex melhorado para capturar linhas de dias: DD/MM [dia-da-semana] [pontos] ... [saldo]
  // Ex: 02/02 segunda-feira 07:38 12:05 | 12:53 16:04 | ... -00:22
  // Considera também FERIADO ou folgas que podem estar entre a data e o saldo
  const dayRegex = /(\d{2}\/\d{2})\s+\w+(?:-feira)?\s+(.*?)\s+([+-]?\d{2}:\d{2})$/gm;

  let match;
  while ((match = dayRegex.exec(text)) !== null) {
    const [_, dia, centerContent, saldoStr] = match;

    // 1. Falta Não Justificada
    if (centerContent.includes("FALTA") || centerContent.includes("FALTA NAO JUSTIFICADA")) {
       criticas.push({
         tipo: "erro",
         mensagem: `Falta não justificada identificada no dia ${dia}`,
         dia
       });
    }

    // 2. Marcações Ímpares
    const batidas = centerContent.match(/\d{2}:\d{2}/g) || [];
    if (batidas.length > 0 && batidas.length % 2 !== 0) {
      criticas.push({
        tipo: "alerta",
        mensagem: `Inconsistência de batida (marcação ímpar) no dia ${dia}`,
        dia
      });
    }

    // 3. Atrasos / Débito
    const saldoMinutos = timeToMinutes(saldoStr);
    if (saldoMinutos < 0) {
      criticas.push({
        tipo: "alerta",
        mensagem: `Atraso/Débito de horas registrado no dia ${dia} (${saldoStr})`,
        dia
      });
    }

    // 4. Horas Adicionais Excessivas
    if (saldoMinutos > options.horasAdicionaisLimite * 60) {
      criticas.push({
        tipo: "alerta",
        mensagem: `Atenção: Mais de ${options.horasAdicionaisLimite}h adicionais realizadas no dia ${dia} (${saldoStr})`,
        dia
      });
    }
  }

  // Fallback para faltas se o regex de linha falhar mas a string existir solta
  if (text.includes("FALTA NAO JUSTIFICADA") && !criticas.some(c => c.mensagem.includes("Falta"))) {
     // Tentar encontrar o dia próximo à string
  }

  return criticas;
}
