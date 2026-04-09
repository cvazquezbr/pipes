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
  equipe: string;
}

export interface Critica {
  tipo: "erro" | "alerta" | "sucesso";
  categoria?: string;
  mensagem: string;
  dia?: string;
}

export const CRITICA_CATEGORIES = {
  FALTA: "Faltas",
  BATIDA_IMPAR: "Batidas Ímpares",
  DEBITO: "Débito de Horas",
  EXTRA: "Horas Extras",
  INTERVALO: "Intervalo",
  POSSIVEL_FALTA_INTERVALO: "Possível falta de intervalo",
} as const;

export interface FolhaPontoResult {
  cpf: string;
  nome: string;
  email: string;
  equipe: string;
  matchStatus: "encontrado" | "nao_encontrado" | "folha_ausente" | "cpf_extra";
  criticas: Critica[];
  pdfBuffer?: Uint8Array;
  paginas: number[];
  rawText: string;
}

export interface ProcessingOptions {
  horasAdicionaisLimite: number;
  horasDebitoLimite: number;
  intervaloAlmocoTolerancia?: number;
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
 * Parse da planilha de trabalhadores e mapeamento de chefes
 */
export async function parseWorkersExcel(file: File): Promise<{ workers: WorkerData[], teamChiefs: Record<string, string> }> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);

  // 1. Processar Funcionários (Primeira Aba)
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Tenta encontrar a linha de cabeçalho real procurando por colunas conhecidas
  const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  let headerIndex = 0;
  for (let i = 0; i < Math.min(allRows.length, 20); i++) {
    const row = (allRows[i] || []).map(c => String(c || "").toLowerCase().trim());
    if (row.some(c => c === "cpf" || c === "nome" || c.includes("e-mail") || c.includes("email"))) {
      headerIndex = i;
      break;
    }
  }

  const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerIndex, defval: "" }) as any[];

  const normalizeKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  const findValue = (row: any, searchKeys: string[]) => {
    const rowKeys = Object.keys(row);
    const normalizedSearch = searchKeys.map(normalizeKey);

    // 1. Tenta match por chave normalizada (exato ou contido se for nome/equipe)
    for (const rk of rowKeys) {
      const normalizedRowKey = normalizeKey(rk);
      if (normalizedSearch.includes(normalizedRowKey)) {
        return row[rk];
      }

      // Fallback para "Nome Completo" ou similar
      if (searchKeys.includes("Nome") && normalizedRowKey.includes("nome")) return row[rk];
      if (searchKeys.includes("equipe") && normalizedRowKey.includes("equipe")) return row[rk];
    }

    // 2. Se for e-mail, tenta encontrar qualquer coluna que contenha um '@'
    if (searchKeys.includes("E-mail")) {
      for (const rk of rowKeys) {
        const val = String(row[rk] || "");
        if (val.includes("@") && val.includes(".")) return val;
      }
    }

    return undefined;
  };

  const workers = jsonData
    .map(row => {
      const nome = String(findValue(row, ["Nome"]) || "").trim();
      const email = String(findValue(row, ["E-mail", "Email", "Correio Eletrônico"]) || "").trim();
      const cpf = String(findValue(row, ["CPF"]) || "").replace(/\D/g, "");
      const equipe = String(findValue(row, ["equipe", "Equipe"]) || "Sem Equipe").trim();
      const vinculo = String(findValue(row, ["Vínculo", "Vinculo"]) || "").toUpperCase().trim();

      // Validação básica de e-mail para evitar pegar colunas erradas (se pegou pelo fallback)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validEmail = emailRegex.test(email) ? email : "";

      return {
        nome,
        email: validEmail,
        cpf,
        equipe: equipe || "Sem Equipe",
        vinculo
      };
    })
    .filter(w => {
      // Filtrar linhas vazias ou cabeçalhos que foram pegos como dados
      if (!w.nome && !w.cpf) return false;
      // Filtrar vínculos desligados
      if (["X", "D"].includes(w.vinculo)) return false;
      return true;
    })
    .map(({ vinculo, ...rest }) => rest);

  // 2. Processar Chefes (Segunda Aba)
  const teamChiefs: Record<string, string> = {};
  const secondSheetName = workbook.SheetNames[1];
  if (secondSheetName) {
    const chiefSheet = workbook.Sheets[secondSheetName];
    const chiefData = XLSX.utils.sheet_to_json(chiefSheet, { header: 1 }) as any[][];

    // Ignorar cabeçalho se houver e mapear
    chiefData.forEach((row, index) => {
      if (index === 0 && (String(row[0]).toLowerCase().includes("equipe") || String(row[1]).toLowerCase().includes("email"))) {
        return;
      }
      const team = String(row[0] || "").trim();
      const email = String(row[1] || "").trim();
      if (team && email) {
        teamChiefs[team] = email;
      }
    });
  }

  return { workers, teamChiefs };
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
      equipe: w.equipe,
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

    // Agrupa texto por linha baseado na posição vertical (Y)
    let pageRawText = "";
    let lastY: number | null = null;

    for (const item of textContent.items as any[]) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        pageRawText += "\n";
      }
      pageRawText += item.str + " ";
      lastY = y;
    }

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
          equipe: "Sem Equipe",
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
  const lines = text.split('\n');

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const dateMatch = line.match(/\b(\d{2}\/\d{2})\b/);
    if (!dateMatch) continue;

    const dia = dateMatch[1];
    // Ignorar linhas de cabeçalho, rodapé ou metadados
    if (
      line.includes("Admissão:") ||
      line.includes("Emissão:") ||
      line.includes("DIA / MÊS") ||
      line.includes("DADOS DO EMPREGADOR") ||
      line.includes("Página") ||
      /\d{2}\/\d{2}\/\d{4}/.test(line) // Datas com ano (comum em rodapés)
    ) continue;

    const weekdayMatch = line.toLowerCase().match(/domingo|segunda|terça|quarta|quinta|sexta|sabado|sábado|seg|ter|qua|qui|sex|dom|sab/);
    const isWeekend = weekdayMatch && ["domingo", "dom", "sabado", "sábado", "sab"].includes(weekdayMatch[0]);
    const isWorkingDay = weekdayMatch && !isWeekend;

    if (line.includes("FALTA NAO JUSTIFICADA") || line.includes("FALTA")) {
       criticas.push({
         tipo: "erro",
         categoria: CRITICA_CATEGORIES.FALTA,
         mensagem: `Falta não justificada identificada no dia ${dia}`,
         dia
       });
       continue;
    }

    const allTimes = (line.match(/[+-]?\s*\d{1,2}:\d{2}/g) || []).map(t => t.replace(/\s+/g, ""));
    if (allTimes.length === 0) continue;

    let batidas: string[] = [];
    let saldoStr = "00:00";
    let totalStr = "00:00";

    if (isWorkingDay) {
       // No layout Solides/Fatto, a linha costuma ser:
       // punches ... [weekday] [previstas] [date] [saldo] [total]
       // Ex: (m)08:00 12:00 | (m)13:00 17:00 | quarta-feira 08:00 18/03 08:00

       const dateIndex = line.indexOf(dia);
       const textBeforeDate = line.substring(0, dateIndex);
       const textAfterDate = line.substring(dateIndex + dia.length);

       // 1. Extrair Batidas (Tudo antes da data, removendo o previsto)
       const timesBeforeDate = (textBeforeDate.match(/\d{1,2}:\d{2}/g) || []);
       const hasWeekday = textBeforeDate.toLowerCase().match(/domingo|segunda|terça|quarta|quinta|sexta|sabado|sábado|seg|ter|qua|qui|sex|dom|sab/);

       if (hasWeekday && timesBeforeDate.length > 0) {
         batidas = timesBeforeDate.slice(0, -1); // Remove o 'previstas'
       } else {
         batidas = timesBeforeDate;
       }

       // 2. Extrair Saldo e Total (Tudo após a data)
       const timesAfterDate = (textAfterDate.match(/[+-]?\s*\d{1,2}:\d{2}/g) || []).map(t => t.replace(/\s+/g, ""));

       // O saldo é o primeiro que tem sinal, ou o primeiro se não houver sinais mas houver dois valores
       let sIdx = timesAfterDate.findIndex(t => t.startsWith('+') || t.startsWith('-'));
       if (sIdx !== -1) {
          saldoStr = timesAfterDate[sIdx];
          totalStr = timesAfterDate[sIdx + 1] || "00:00";
       } else if (timesAfterDate.length >= 1) {
          // Caso sem saldo explícito (saldo zero muitas vezes não vem com sinal no OCR)
          // Se tiver apenas 1 valor depois da data, é o TOTAL. O Saldo é 00:00.
          if (timesAfterDate.length === 1) {
             saldoStr = "00:00";
             totalStr = timesAfterDate[0];
          } else {
             // Se tiver 2 ou mais, assumimos [SALDO, TOTAL]
             saldoStr = timesAfterDate[0];
             totalStr = timesAfterDate[1];
          }
       }
    } else {
       batidas = allTimes.filter(t => !t.startsWith('+') && !t.startsWith('-'));
    }

    if (isWeekend && batidas.length === 0) continue;

    if (batidas.length > 0 && batidas.length % 2 !== 0) {
      criticas.push({
        tipo: "alerta",
        categoria: CRITICA_CATEGORIES.BATIDA_IMPAR,
        mensagem: `Inconsistência de batida (marcação ímpar) no dia ${dia}`,
        dia
      });
    }

    const saldoMin = timeToMinutes(saldoStr);
    const debitLimitMin = options.horasDebitoLimite * 60;
    const extraLimitMin = options.horasAdicionaisLimite * 60;

    if (saldoMin < -debitLimitMin) {
      const limitStr = String(options.horasDebitoLimite).padStart(2, '0') + ':00';
      criticas.push({
        tipo: "alerta",
        categoria: CRITICA_CATEGORIES.DEBITO,
        mensagem: `Atenção: Mais de ${limitStr}h de débito registradas no dia ${dia} (${saldoStr})`,
        dia
      });
    }

    if (saldoMin > extraLimitMin) {
      const limitStr = String(options.horasAdicionaisLimite).padStart(2, '0') + ':00';
      criticas.push({
        tipo: "alerta",
        categoria: CRITICA_CATEGORIES.EXTRA,
        mensagem: `Atenção: Mais de ${limitStr}h adicionais realizadas no dia ${dia} (${saldoStr})`,
        dia
      });
    }

    if (isWorkingDay && batidas.length >= 2) {
      const workedMin = Math.abs(timeToMinutes(totalStr));

      // Cálculo de intervalos (pausas)
      let pauseMin = 0;
      if (batidas.length >= 4) {
        for (let j = 1; j < batidas.length - 1; j += 2) {
          const exit = timeToMinutes(batidas[j]);
          const entry = timeToMinutes(batidas[j + 1]);
          if (entry > exit) {
            pauseMin += (entry - exit);
          }
        }
      }

      // Regras de Intervalo:
      const tolerance = options.intervaloAlmocoTolerancia !== undefined ? options.intervaloAlmocoTolerancia : 15;

      // Acima de 6 horas diárias: Mínimo de 1 hora e máximo de 2 horas.
      if (workedMin > 360) {
        const minInterval = Math.max(0, 60 - tolerance);
        const maxInterval = 120 + tolerance;

        if (pauseMin < minInterval) {
          criticas.push({
            tipo: "alerta",
            categoria: CRITICA_CATEGORIES.INTERVALO,
            mensagem: `Intervalo insuficiente no dia ${dia} (${pauseMin}min). Mínimo de 1h para jornada > 6h.`,
            dia
          });
        } else if (pauseMin > maxInterval) {
          criticas.push({
            tipo: "alerta",
            categoria: CRITICA_CATEGORIES.INTERVALO,
            mensagem: `Intervalo excedente no dia ${dia} (${pauseMin}min). Máximo de 2h para jornada > 6h.`,
            dia
          });
        }
      }
      // 4 a 6 horas diárias: 15 minutos obrigatórios.
      else if (workedMin > 240) {
        const minInterval = Math.max(0, 15 - tolerance);

        if (pauseMin < minInterval) {
          criticas.push({
            tipo: "alerta",
            categoria: CRITICA_CATEGORIES.INTERVALO,
            mensagem: `Intervalo insuficiente no dia ${dia} (${pauseMin}min). Mínimo de 15min para jornada entre 4h e 6h.`,
            dia
          });
        }
      }
      // Até 4 horas diárias: Sem intervalo obrigatório. (Nada a fazer)

      // Legado: Alerta simples para 2 batidas e jornada longa
      if (batidas.length === 2 && workedMin > 300 && !criticas.some(c => c.dia === dia && c.mensagem.includes("Intervalo"))) {
        criticas.push({
          tipo: "alerta",
          categoria: CRITICA_CATEGORIES.POSSIVEL_FALTA_INTERVALO,
          mensagem: `Possível falta de intervalo de almoço no dia ${dia}`,
          dia
        });
      }
    }
  }

  return criticas;
}
