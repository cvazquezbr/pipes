import * as pdfjsLib from "pdfjs-dist";

// Configurar worker do PDF.js apenas se estiver no navegador
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
}

export interface ExtractedInforme {
  matricula: string;
  nome: string;
  totalRendimentos: number;
  previdenciaOficial: number;
  irrf: number;
  decimoTerceiro: number;
  irrfDecimoTerceiro: number;
  plr: number;
  planoSaude: {
    beneficiario: string;
    valor: number;
  }[];
  rawText?: string;
}

/**
 * Converte valor monetário brasileiro para número
 */
function parseBRLValue(value: string): number {
  if (!value || value === "-") return 0;
  // Remove R$, espaços e pontos de milhar, troca vírgula por ponto
  const cleaned = value.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".").trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Normaliza texto do PDF
 */
function normalizeText(text: string): string {
  let normalized = text
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200C\u200D\u200E\u200F]/g, "")
    .replace(/[\u061C\u180E]/g, " ");

  normalized = normalized.replace(/\s+/g, " ");
  return normalized;
}

/**
 * Extrai dados do informe de rendimentos do texto bruto
 */
export function parseInformeText(text: string): ExtractedInforme[] {
  const normalized = normalizeText(text);

  // O PDF pode conter vários informes. Geralmente cada um começa com algo como "Comprovante de Rendimentos"
  // ou os dados da fonte pagadora.
  // No entanto, a forma mais segura de dividir é pelo Nome Completo que contém a matrícula.

  // Padrão para identificar o início de um novo trabalhador e extrair Nome e Matrícula
  // "Nome Completo: NOME - MATRICULA"
  const workerSplitPattern = /Nome Completo\s*:\s*([^-]+?)\s*-\s*(\d+)/g;

  const informes: ExtractedInforme[] = [];
  let match;
  const workerIndices: {index: number, nome: string, matricula: string}[] = [];

  while ((match = workerSplitPattern.exec(normalized)) !== null) {
    workerIndices.push({
      index: match.index,
      nome: match[1].trim(),
      matricula: match[2].trim()
    });
  }

  if (workerIndices.length === 0) return [];

  for (let i = 0; i < workerIndices.length; i++) {
    const current = workerIndices[i];
    const next = workerIndices[i + 1];
    const workerText = normalized.substring(current.index, next ? next.index : normalized.length);

    const informe: ExtractedInforme = {
      matricula: current.matricula,
      nome: current.nome,
      totalRendimentos: 0,
      previdenciaOficial: 0,
      irrf: 0,
      decimoTerceiro: 0,
      irrfDecimoTerceiro: 0,
      plr: 0,
      planoSaude: [],
      rawText: workerText
    };

    // 1. Total dos rendimentos (inclusive férias)
    const totalRendMatch = workerText.match(/1\.\s*Total\s*dos\s*rendimentos\s*\(inclusive\s*férias\)\s*([\d.,]+)/i);
    if (totalRendMatch) informe.totalRendimentos = parseBRLValue(totalRendMatch[1]);

    // 2. Contribuição previdenciária oficial
    const prevMatch = workerText.match(/2\.\s*Contribuição\s*previdenciária\s*oficial\s*([\d.,]+)/i);
    if (prevMatch) informe.previdenciaOficial = parseBRLValue(prevMatch[1]);

    // 5. Imposto sobre a Renda Retido na Fonte (IRRF)
    const irrfMatch = workerText.match(/5\.\s*Imposto\s*sobre\s*a\s*Renda\s*Retido\s*na\s*Fonte\s*\(IRRF\)\s*([\d.,]+)/i);
    if (irrfMatch) informe.irrf = parseBRLValue(irrfMatch[1]);

    // 1. 13º (décimo terceiro) salário
    const decimoMatch = workerText.match(/1\.\s*13º\s*\(décimo\s*terceiro\)\s*salário\s*([\d.,]+)/i);
    if (decimoMatch) informe.decimoTerceiro = parseBRLValue(decimoMatch[1]);

    // 2. Imposto sobre a Renda Retido na Fonte sobre 13º (décimo terceiro) salário
    const irrfDecimoMatch = workerText.match(/2\.\s*Imposto\s*sobre\s*a\s*Renda\s*Retido\s*na\s*Fonte\s*sobre\s*13º\s*\(décimo\s*terceiro\)\s*salário\s*([\d.,]+)/i);
    if (irrfDecimoMatch) informe.irrfDecimoTerceiro = parseBRLValue(irrfDecimoMatch[1]);

    // 3. Outros.Participação de lucros
    const plrMatch = workerText.match(/3\.\s*Outros\.\s*Participação\s*de\s*lucros\s*([\d.,]+)/i);
    if (plrMatch) informe.plr = parseBRLValue(plrMatch[1]);

    // Plano de Saúde
    // Geralmente em Informações Complementares: "Beneficiário do Plano de Saúde: ... Valor Pago: ..."
    // Pode haver múltiplos.
    const planoSaudePattern = /Beneficiário\s*do\s*Plano\s*de\s*Saúde\s*[:;]?\s*(.*?)\s*Valor\s*Pago\s*[:;]?\s*([\d.,]+)/gi;
    let psMatch;
    while ((psMatch = planoSaudePattern.exec(workerText)) !== null) {
      informe.planoSaude.push({
        beneficiario: psMatch[1].trim(),
        valor: parseBRLValue(psMatch[2])
      });
    }

    informes.push(informe);
  }

  return informes;
}

/**
 * Processa um arquivo PDF de Informe de Rendimentos
 */
export async function extractInformesFromPDF(file: File): Promise<ExtractedInforme[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return parseInformeText(fullText);
}
