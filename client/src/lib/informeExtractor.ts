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

  // 3. Normalizar espaços múltiplos. Não removemos quebras de linha aqui pois o extrator de PDF já cuidou de organizá-las.
  normalized = normalized.replace(/[ \t]+/g, " ");

  return normalized.trim();
}

/**
 * Extrai dados do informe de rendimentos do texto bruto
 */
export function parseInformeText(text: string): ExtractedInforme[] {
  console.log("[InformeExtractor] Iniciando parse de texto. Tamanho:", text.length);
  const normalized = normalizeText(text);

  // Padrão para identificar o início de um novo trabalhador e extrair Nome e Matrícula.
  // Usamos uma busca que permite quebras de linha entre o rótulo e os dados, mas que para no próximo "Nome Completo".
  // A matrícula é identificada por um hífen que NÃO seja precedido por um dígito (para evitar o hífen do CPF).
  const workerSplitPattern = /Nome\s+Completo\s*[:;]?\s*(?:CPF\s*)?((?:(?!Nome\s+Completo)[\s\S])*?)(?<!\d)[-–—]\s*(\d+)(?![.\d])/gi;

  const informes: ExtractedInforme[] = [];
  let match;
  const workerIndices: {index: number, nome: string, matricula: string}[] = [];

  while ((match = workerSplitPattern.exec(normalized)) !== null) {
    let nome = match[1] ? match[1].trim() : "";
    const matricula = match[2];

    // Se "Fonte Pagadora" aparecer logo antes, ignoramos pois é o cabeçalho do documento
    const contextBefore = normalized.substring(Math.max(0, match.index - 50), match.index).toUpperCase();
    if (contextBefore.includes("FONTE PAGADORA") || contextBefore.includes("EMPRESARIAL")) {
      console.log(`[InformeExtractor] Ignorando seção de Fonte Pagadora: ${matricula}`);
      continue;
    }

    // Limpeza adicional de labels de formulário que podem ter sobrado
    nome = nome.replace(/^(DO BENEFICIÁRIO|DO TRABALHADOR|NOME|COMPLETO|CPF)\s*/i, "").trim();

    // Remover CPF do início do nome se presente (ex: 935.016.503-10 AGNALDO...)
    nome = nome.replace(/^\d{3}\.\d{3}\.\d{3}-\d{2}\s*/, "").trim();

    // Se o nome ficou vazio (Formato 2), tentamos olhar o que vem logo após a matrícula/CPF
    if (!nome) {
      const afterMatch = normalized.substring(match.index + match[0].length).match(/^[ \t]*(?:[\d.-]+[ \t]+)?([A-ZÀ-Ú ]{3,})/);
      if (afterMatch) {
        nome = afterMatch[1].trim();
      }
    }

    // Filtro para evitar capturar CNPJ/CPF da fonte pagadora ou rótulos de seção
    const upperNome = nome.toUpperCase();
    const isInvalid =
      upperNome.includes("CNPJ") ||
      upperNome.includes("FONTE PAGADORA") ||
      upperNome.includes("NOME EMPRESARIAL") ||
      (nome === "" && matricula.length > 8) || // Provavelmente um CPF/CNPJ sem nome detectado
      (nome === "" && matricula.length <= 2); // Provavelmente um número de seção (ex: "2. Nome Completo")

    if (isInvalid) {
      console.log(`[InformeExtractor] Ignorando possível falso positivo: ${nome} - ${matricula}`);
      continue;
    }

    console.log(`[InformeExtractor] Encontrado trabalhador: ${nome} - Matrícula: ${matricula}`);
    workerIndices.push({
      index: match.index,
      nome: nome || `Trabalhador ${matricula}`,
      matricula
    });
  }

  if (workerIndices.length === 0) {
    console.warn("[InformeExtractor] Nenhum padrão 'Nome Completo' encontrado no texto");
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

    const extract = (labelPattern: string) => {
      // 1. Procurar na mesma linha (mais confiável)
      const lines = workerText.split('\n');
      for (const line of lines) {
        if (new RegExp(labelPattern, 'i').test(line)) {
          // Tenta antes: [Valor] [Rubrica]
          const beforeMatch = line.match(new RegExp(`([\\d.]+,[\\d]{2})\\s*${labelPattern}`, 'i'));
          if (beforeMatch) return parseBRLValue(beforeMatch[1]);

          // Tenta depois: [Rubrica] [opcional qualquer coisa exceto digito] [Valor]
          const afterMatch = line.match(new RegExp(`${labelPattern}[^\\d]*?([\\d.]+,[\\d]{2})`, 'i'));
          if (afterMatch) return parseBRLValue(afterMatch[1]);
        }
      }

      // 2. Se não achou na mesma linha, tenta busca relaxada no texto do trabalhador
      // Tenta ANTES (valor pode estar na linha anterior se a quebra de linha ocorreu entre valor e rubrica)
      // Usamos [\\s\\S]{0,100}? para buscar o valor mais próximo da rubrica
      const relaxedBeforeMatch = workerText.match(new RegExp(`([\\d.]+,[\\d]{2})[\\s\\S]{0,100}?${labelPattern}`, 'i'));
      if (relaxedBeforeMatch) return parseBRLValue(relaxedBeforeMatch[1]);

      // Tenta DEPOIS
      const relaxedAfterMatch = workerText.match(new RegExp(`${labelPattern}[\\s\\S]{0,100}?([\\d.]+,[\\d]{2})`, 'i'));
      if (relaxedAfterMatch) return parseBRLValue(relaxedAfterMatch[1]);

      return 0;
    };

    informe.totalRendimentos = extract('1\\.\\s*Total\\s*dos\\s*rendimentos');
    informe.previdenciaOficial = extract('2\\.\\s*Contribuição\\s*previdenciária');
    informe.irrf = extract('5\\.\\s*Imposto\\s*sobre\\s*a\\s*Renda\\s*Retido\\s*na\\s*Fonte\\s*\\(IRRF\\)');
    informe.decimoTerceiro = extract('1\\.\\s*13º\\s*\\(décimo\\s*terceiro\\)\\s*salário');
    informe.irrfDecimoTerceiro = extract('2\\.\\s*Imposto\\s*sobre\\s*a\\s*Renda\\s*Retido\\s*na\\s*Fonte\\s*sobre\\s*13º\\s*\\(décimo\\s*terceiro\\)\\s*salário');
    informe.plr = extract('3\\.\\s*Outros\\.\\s*Participação\\s*de\\s*lucros');

    // Plano de Saúde (Geralmente mantém o padrão Label: Value mesmo em layouts "Antes")
    const planoSaudePattern = /Beneficiário\s*do\s*Plano\s*de\s*Saúde\s*[:;]?\s*(.*?)\s*Valor\s*Pago\s*[:;]?\s*([\d.,]+)/gi;
    let psMatch;
    while ((psMatch = planoSaudePattern.exec(workerText)) !== null) {
      informe.planoSaude.push({
        beneficiario: psMatch[1].trim(),
        valor: parseBRLValue(psMatch[2])
      });
    }

    // Outro formato de Plano de Saúde: DESCONTO PLANO DE SAÚDE [valor]
    const planoSaudeDescontoPattern = /DESCONTO\s+PLANO\s+DE\s+SAÚDE\s+([\d.,]+)/gi;
    while ((psMatch = planoSaudeDescontoPattern.exec(workerText)) !== null) {
      informe.planoSaude.push({
        beneficiario: "DESCONTO PLANO DE SAÚDE",
        valor: parseBRLValue(psMatch[1])
      });
    }

    // Se todos os campos financeiros forem zero, provavelmente é um falso positivo (ex: cabeçalhos, templates)
    const hasData = informe.totalRendimentos !== 0 ||
                    informe.previdenciaOficial !== 0 ||
                    informe.irrf !== 0 ||
                    informe.decimoTerceiro !== 0 ||
                    informe.irrfDecimoTerceiro !== 0 ||
                    informe.plr !== 0 ||
                    informe.planoSaude.length > 0;

    if (hasData) {
      informes.push(informe);
    } else {
      console.log(`[InformeExtractor] Descartando possível falso positivo (sem dados): ${informe.nome} - ${informe.matricula}`);
    }
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

    // Agrupar itens por linha baseada na coordenada Y
    const items = textContent.items as any[];
    items.sort((a, b) => {
      // Diferença pequena em Y é considerada mesma linha
      if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
        return a.transform[4] - b.transform[4]; // Ordena por X
      }
      return b.transform[5] - a.transform[5]; // Ordena por Y decrescente
    });

    let lastY = -1;
    let pageText = "";
    for (const item of items) {
      if (lastY !== -1 && Math.abs(item.transform[5] - lastY) >= 5) {
        pageText += "\n";
      } else if (lastY !== -1) {
        pageText += " ";
      }
      pageText += item.str;
      lastY = item.transform[5];
    }
    fullText += pageText + "\n";
  }

  const normalizedText = normalizeText(fullText);
  const informes = parseInformeText(normalizedText);

  return { informes, rawText: normalizedText };
}
