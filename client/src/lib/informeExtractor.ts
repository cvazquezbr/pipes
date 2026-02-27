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
 * Normaliza texto do PDF removendo caracteres especiais que parecem espaços
 * e outros caracteres "exóticos" ou de controle.
 */
function normalizeText(text: string): string {
  // 1. Substituir todos os tipos de espaços Unicode por espaço normal
  // Abrange non-breaking space, thin space, zero-width space, etc.
  let normalized = text.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, " ");

  // 2. Remover caracteres de controle e marcas invisíveis
  normalized = normalized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200C\u200D\u200E\u200F\u061C]/g, "");

  // 3. Normalizar espaços múltiplos e quebras de linha
  normalized = normalized.replace(/[ \t]+/g, " ");
  normalized = normalized.replace(/\n\s*\n/g, "\n");

  return normalized.trim();
}

/**
 * Extrai dados do informe de rendimentos do texto bruto
 */
export function parseInformeText(text: string): ExtractedInforme[] {
  console.log("[InformeExtractor] Iniciando parse de texto. Tamanho:", text.length);
  console.log("[InformeExtractor] Amostra do texto (500 chars):", text.substring(0, 500));
  const normalized = normalizeText(text);

  // O PDF pode conter vários informes. Geralmente cada um começa com algo como "Comprovante de Rendimentos"
  // ou os dados da fonte pagadora.
  // No entanto, a forma mais segura de dividir é pelo Nome Completo que contém a matrícula.

  // Padrão para identificar o início de um novo trabalhador e extrair Nome e Matrícula
  // "Nome Completo: NOME - MATRICULA"
  // Mais robusto: aceita diferentes tipos de traços e espaços opcionais.
  const workerSplitPattern = /Nome Completo\s*[:;]?\s*([^-–—\n]+?)\s*[-–—]\s*(\d+)/gi;

  const informes: ExtractedInforme[] = [];
  let match;
  const workerIndices: {index: number, nome: string, matricula: string}[] = [];

  while ((match = workerSplitPattern.exec(normalized)) !== null) {
    const nome = match[1].trim();
    const matricula = match[2].trim();

    // Filtro para evitar capturar CNPJ/CPF da fonte pagadora que pode estar próximo a "Nome Completo"
    // Se o nome contiver "CNPJ" ou "CPF", provavelmente é um falso positivo do layout do PDF
    if (nome.toUpperCase().includes("CNPJ") || nome.toUpperCase().includes("CPF")) {
      console.log(`[InformeExtractor] Ignorando possível falso positivo (CNPJ/CPF): ${nome} - ${matricula}`);
      continue;
    }

    console.log(`[InformeExtractor] Encontrado trabalhador: ${nome} - Matrícula: ${matricula}`);
    workerIndices.push({
      index: match.index,
      nome,
      matricula
    });
  }

  if (workerIndices.length === 0) {
    console.warn("[InformeExtractor] Nenhum padrão 'Nome Completo : ... - ...' encontrado no texto");
    // Debug: procurar por Nome Completo sem o resto
    const partialMatch = normalized.match(/Nome Completo\s*[:;]?\s*[^\n]+/gi);
    if (partialMatch) {
        console.log("[InformeExtractor] Encontrados possíveis cabeçalhos de nome (sem matrícula):", partialMatch);
    }
    return [];
  }

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
 * Retorna os informes extraídos e o texto bruto normalizado para debug
 */
export async function extractInformesFromPDF(file: File): Promise<{
  informes: ExtractedInforme[];
  rawText: string;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  const normalizedText = normalizeText(fullText);
  const informes = parseInformeText(normalizedText);

  return { informes, rawText: normalizedText };
}
