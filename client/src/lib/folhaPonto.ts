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
 * Normaliza texto do PDF mantendo quebras de linha para análise por dia
 */
function normalizeText(text: string): string {
  return text
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

/**
 * Converte string de horas (HH:mm ou +-HH:mm) para minutos
 */
function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(":")) return 0;
  const sign = timeStr.includes("-") ? -1 : 1;
  const cleaned = timeStr.replace(/[+-]/g, "").trim();
  const parts = cleaned.split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return sign * (hours * 60 + minutes);
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

  return jsonData
    .filter(row => {
      const vinculo = String(row["Vínculo"] || row["Vinculo"] || row["VINCULO"] || "");
      return !["X", "D"].includes(vinculo.toUpperCase().trim());
    })
    .map(row => {
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
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const originalPdfLibDoc = await PDFDocument.load(arrayBuffer.slice(0));

  const resultsMap = new Map<string, FolhaPontoResult>();

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

    const cpfMatch = text.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/) || text.match(/CPF:\s*(\d{11})/);
    let cpf = cpfMatch ? cpfMatch[1].replace(/\D/g, "") : null;

    if (cpf) {
      let result = resultsMap.get(cpf);
      if (!result) {
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

      const criticas = analyzePageCriticas(text, options);
      result.criticas.push(...criticas);
    }

    if (onProgress) onProgress(Math.round((i / totalPages) * 100));
  }

  const finalResults = Array.from(resultsMap.values());

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

  const dateRegex = /(\d{2}\/\d{2})/g;
  const matches = Array.from(text.matchAll(dateRegex));

  if (matches.length === 0) return [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const dia = match[1];
    const startIdx = match.index!;
    const nextMatch = matches[i+1];
    const endIdx = nextMatch ? nextMatch.index! : text.length;

    const lookback = 80;
    const contextStart = Math.max(0, startIdx - lookback);
    const dayBlock = text.substring(contextStart, endIdx);
    const beforeDate = text.substring(contextStart, startIdx);

    // Ignorar datas que fazem parte de cabeçalhos ou metadados
    if (
      beforeDate.includes("Admissão:") ||
      beforeDate.includes("Emissão:") ||
      dayBlock.includes("DIA / MÊS") ||
      dayBlock.includes("DADOS DO EMPREGADOR") ||
      dayBlock.includes("Quadro de Horários") ||
      dayBlock.includes("Página")
    ) {
      continue;
    }

    if (dayBlock.includes("FALTA NAO JUSTIFICADA") || dayBlock.includes("FALTA")) {
       criticas.push({
         tipo: "erro",
         mensagem: `Falta não justificada identificada no dia ${dia}`,
         dia
       });
       continue;
    }

    const rawTimes = dayBlock.match(/[+-]?\s*\d{1,2}:\d{2}/g) || [];
    const times = rawTimes.map(t => t.replace(/\s+/g, ""));

    if (times.length === 0) continue;

    const isDiaUtil = dayBlock.toLowerCase().match(/segunda|terça|quarta|quinta|sexta|seg|ter|qua|qui|sex/);

    let saldoStr = "00:00";
    let totalStr = "00:00";
    let batidas: string[] = [];

    if (isDiaUtil) {
       let saldoIdx = times.findIndex(t => t.startsWith('+') || t.startsWith('-'));

       if (saldoIdx !== -1) {
         saldoStr = times[saldoIdx];
         totalStr = times[saldoIdx + 1] || "00:00";

         batidas = times.filter((t, idx) => {
            if (idx === saldoIdx) return false;
            if (idx === 0) return false;
            if (idx === (saldoIdx + 1)) return false;
            if (t === dia) return false;
            return true;
         });
       } else if (times.length >= 3) {
         saldoStr = times[1];
         totalStr = times[2];
         batidas = times.slice(3);
       } else {
         batidas = times.slice(1);
       }
    } else {
       let saldoIdx = times.findIndex(t => t.startsWith('+') || t.startsWith('-'));
       if (saldoIdx !== -1) {
          saldoStr = times[saldoIdx];
          batidas = times.filter((_, idx) => idx !== saldoIdx);
       } else {
          batidas = times;
       }
    }

    if (batidas.length > 0 && batidas.length % 2 !== 0) {
      criticas.push({
        tipo: "alerta",
        mensagem: `Inconsistência de batida (marcação ímpar) no dia ${dia}`,
        dia
      });
    }

    const saldoMinutos = timeToMinutes(saldoStr);
    if (saldoMinutos < 0) {
      criticas.push({
        tipo: "alerta",
        mensagem: `Atraso/Débito de horas registrado no dia ${dia} (${saldoStr})`,
        dia
      });
    }

    if (saldoMinutos > options.horasAdicionaisLimite * 60) {
      criticas.push({
        tipo: "alerta",
        mensagem: `Atenção: Mais de ${options.horasAdicionaisLimite}h adicionais realizadas no dia ${dia} (${saldoStr})`,
        dia
      });
    }

    if (isDiaUtil && batidas.length === 2) {
       const totalWorkedMin = Math.abs(timeToMinutes(totalStr));
       if (totalWorkedMin > 300) {
          criticas.push({
            tipo: "alerta",
            mensagem: `Possível falta de intervalo de almoço no dia ${dia}`,
            dia
          });
       }
    }
  }

  return criticas;
}
