/**
 * Utilitários para processamento de Declaração de Rendimentos
 */

import * as XLSX from "xlsx";

const VALOR_DEDUCAO_DEPENDENTE = 189.59;

export interface Lancamento {
  codigo: number | string;
  valor: number | string;
  descricao?: string;
  natureza?: string;
}

export interface Contracheque {
  ano: number | string;
  lancamentos: Lancamento[];
  nomeFolha?: string;
  [key: string]: any; // Permite outros campos como valorLiquido, etc.
}

export interface Dependente {
  nome: string;
  criterioFiscal: boolean;
}

export interface Gozo {
  proventos: number | string;
  Pagamento: string;
  descricao?: string;
  simplificado?: boolean;
  irSimplificado?: number | string;
  irBaseadoEmDeducoes?: number | string;
  inss?: number | string;
}

export interface PeriodoAquisitivo {
  gozos: Gozo[];
}

export interface WorkerData {
  matricula: string;
  nome: string;
  cpf: string;
  contracheques: Contracheque[];
  periodosAquisitivos?: PeriodoAquisitivo[];
  dependentes?: Dependente[];
}

export interface DetailLancamento {
  origem: string;
  codigo?: string | number;
  descricao?: string;
  valor: number;
  data?: string;
}

export interface AggregatedWorkerData {
  matricula: string;
  nome: string;
  cpf: string;
  "Rendimentos Tributáveis": number;
  "Previdência Oficial": number;
  "IRRF (Mensal/Férias)": number;
  "Base Cálculo IRRF": number;
  "13º Salário (Exclusiva)": number;
  "IRRF sobre 13º (Exclusiva)": number;
  "CP 13º Salário": number;
  "PLR (Exclusiva)": number;
  "IRRF sobre PLR (Exclusiva)": number;
  "Desconto Plano de Saúde": number;
  "Rendimentos Isentos": number;
  details: Record<string, DetailLancamento[]>;
  pdfData?: {
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
  };
}

/**
 * Converte valor monetário (string ou número) para número float.
 * Trata formatos brasileiros como "1.234,56" ou "R$ 1.234,56"
 */
export function parseValue(val: string | number): number {
  if (typeof val === "number") return val;
  if (!val) return 0;

  // Remove R$, espaços e outros caracteres não numéricos exceto vírgula e ponto
  let cleaned = val.replace(/[^\d.,-]/g, "");

  // Se houver tanto ponto quanto vírgula, o ponto é separador de milhar
  if (cleaned.includes(".") && cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  // Se houver apenas vírgula e ela estiver nas últimas 3 posições, é decimal
  else if (
    cleaned.includes(",") &&
    cleaned.indexOf(",") >= cleaned.length - 3
  ) {
    cleaned = cleaned.replace(",", ".");
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

/**
 * Agrega dados do contracheque para cada trabalhador conforme as regras de códigos e ano
 */
export function aggregateWorkerData(
  workers: WorkerData[],
  year: string | number
): AggregatedWorkerData[] {
  const targetYear = String(year);

  // Filtrar trabalhadores que possuem pelo menos um contracheque ou gozo no ano alvo
  const filteredWorkers = workers.filter(worker => {
    const hasContracheque =
      Array.isArray(worker.contracheques) &&
      worker.contracheques.some(cc => cc.ano && String(cc.ano) === targetYear);

    const hasGozo =
      Array.isArray(worker.periodosAquisitivos) &&
      worker.periodosAquisitivos.some(
        pa =>
          Array.isArray(pa.gozos) &&
          pa.gozos.some(g => g.Pagamento && g.Pagamento.startsWith(targetYear))
      );

    return hasContracheque || hasGozo;
  });

  return filteredWorkers.map(worker => {
    let dependentDeductionApplied = false;

    const aggregated: AggregatedWorkerData = {
      matricula: String(worker.matricula || ""),
      nome: String(worker.nome || ""),
      cpf: String(worker.cpf || ""),
      "Rendimentos Tributáveis": 0,
      "Previdência Oficial": 0,
      "IRRF (Mensal/Férias)": 0,
      "Base Cálculo IRRF": 0,
      "13º Salário (Exclusiva)": 0,
      "IRRF sobre 13º (Exclusiva)": 0,
      "CP 13º Salário": 0,
      "PLR (Exclusiva)": 0,
      "IRRF sobre PLR (Exclusiva)": 0,
      "Desconto Plano de Saúde": 0,
      "Rendimentos Isentos": 0,
      details: {
        "Rendimentos Tributáveis": [],
        "Previdência Oficial": [],
        "IRRF (Mensal/Férias)": [],
        "Base Cálculo IRRF": [],
        "13º Salário (Exclusiva)": [],
        "IRRF sobre 13º (Exclusiva)": [],
        "CP 13º Salário": [],
        "PLR (Exclusiva)": [],
        "IRRF sobre PLR (Exclusiva)": [],
        "Desconto Plano de Saúde": [],
        "Rendimentos Isentos": [],
      },
    };

    const rules = {
      rendimentosTributaveis: [
        "8781",
        "931",
        "8783",
        "8784",
        "8797",
        "9380",
        "8490",
        "221",
        "19",
        "150",
        "207",
        "244",
        "249",
        "250",
        "805",
        "806",
        "937",
        "940",
        "8112",
        "8125",
        "8832",
        "8870",
        "9180",
        "9384",
        "9661",
      ],
      previdenciaOficial: ["812", "821", "998", "843", "825","826", "858"],
      inssDifFerDescAMaior: "836",
      irrfMensal: ["999", "942", "828", "8128"],
      salario13: ["12", "8104", "800", "801", "802", "8216", "8374", "8550"],
      irrf13: ["804", "827"],
      cp13: ["825"],
      plr: ["873", "242"],
      irrfPlr: ["874"],
      planoSaude: "8111",
      reembolsoPlanoSaude: "8917",
      rendimentosIsentos: [
        "932",
        "8169",
        "28",
        "29",
        "64",
        "830",
        "9591",
        "8800",
      ],
    };

    if (Array.isArray(worker.contracheques)) {
      worker.contracheques.forEach(cc => {
        // Filtrar por ano no nível do contracheque
        if (cc.ano && String(cc.ano) !== targetYear) {
          return;
        }

        // Acumular Base Cálculo IRRF do contracheque
        if (cc.baseCalculoIrrf) {
          const valorBC = parseValue(cc.baseCalculoIrrf);
          aggregated["Base Cálculo IRRF"] += valorBC;
          aggregated.details["Base Cálculo IRRF"].push({
            origem: `${cc.ano} / ${cc.nomeFolha}`,
            descricao: "Base Cálculo IRRF",
            valor: valorBC,
          });
        }

        if (Array.isArray(cc.lancamentos)) {
          cc.lancamentos.forEach(item => {
            const codigo = String(item.codigo);
            const valor = parseValue(item.valor);
            const detail: DetailLancamento = {
              origem: `${cc.ano} / ${cc.nomeFolha}`,
              codigo: item.codigo,
              descricao: item.descricao,
              valor: valor,
            };

            if (rules.rendimentosTributaveis.includes(codigo)) {
              aggregated["Rendimentos Tributáveis"] += valor;
              aggregated.details["Rendimentos Tributáveis"].push(detail);
            } else if (rules.previdenciaOficial.includes(codigo)) {
              aggregated["Previdência Oficial"] += valor;
              aggregated.details["Previdência Oficial"].push(detail);
            } else if (codigo === rules.inssDifFerDescAMaior) {
              aggregated["Previdência Oficial"] -= valor;
              aggregated.details["Previdência Oficial"].push({
                ...detail,
                descricao: (detail.descricao || "") + " (Dedução)",
                valor: -valor,
              });
            } else if (rules.irrfMensal.includes(codigo)) {
              aggregated["IRRF (Mensal/Férias)"] += valor;
              aggregated.details["IRRF (Mensal/Férias)"].push(detail);
            } else if (rules.salario13.includes(codigo)) {
              aggregated["13º Salário (Exclusiva)"] += valor;
              aggregated.details["13º Salário (Exclusiva)"].push(detail);
            } else if (rules.irrf13.includes(codigo)) {
              aggregated["IRRF sobre 13º (Exclusiva)"] += valor;
              aggregated.details["IRRF sobre 13º (Exclusiva)"].push(detail);

              // Deduzir do 13º Salário (Exclusiva)
              aggregated["13º Salário (Exclusiva)"] -= valor;
              aggregated.details["13º Salário (Exclusiva)"].push({
                ...detail,
                descricao: `${detail.descricao || "IRRF 13º"} (Dedução)`,
                valor: -valor,
              });
            } else if (rules.cp13.includes(codigo)) {
              aggregated["CP 13º Salário"] += valor;
              aggregated.details["CP 13º Salário"].push(detail);

              // Deduzir do 13º Salário (Exclusiva)
              aggregated["13º Salário (Exclusiva)"] -= valor;
              aggregated.details["13º Salário (Exclusiva)"].push({
                ...detail,
                descricao: `${detail.descricao || "CP 13º"} (Dedução)`,
                valor: -valor,
              });
            } else if (rules.plr.includes(codigo)) {
              aggregated["PLR (Exclusiva)"] += valor;
              aggregated.details["PLR (Exclusiva)"].push(detail);
            } else if (rules.irrfPlr.includes(codigo)) {
              aggregated["IRRF sobre PLR (Exclusiva)"] += valor;
              aggregated.details["IRRF sobre PLR (Exclusiva)"].push(detail);
            } else if (codigo === rules.planoSaude) {
              aggregated["Desconto Plano de Saúde"] += valor;
              aggregated.details["Desconto Plano de Saúde"].push(detail);
            } else if (codigo === rules.reembolsoPlanoSaude) {
              aggregated["Desconto Plano de Saúde"] -= valor;
              aggregated.details["Desconto Plano de Saúde"].push({
                ...detail,
                descricao: (detail.descricao || "") + " (Reembolso)",
                valor: -valor,
              });
            } else if (rules.rendimentosIsentos.includes(codigo)) {
              aggregated["Rendimentos Isentos"] += valor;
              aggregated.details["Rendimentos Isentos"].push(detail);
            }
          });
        }
      });
    }

    // Processar periodosAquisitivos -> gozos
    //  if (Array.isArray(worker.periodosAquisitivos)) {
    //    worker.periodosAquisitivos.forEach(pa => {
    //      if (Array.isArray(pa.gozos)) {
    //        pa.gozos.forEach(g => {
    //         if (g.Pagamento && g.Pagamento.startsWith(targetYear)) {
    //const valor = parseValue(g.proventos);
    //aggregated['Rendimentos Tributáveis'] += valor;
    //aggregated.details['Rendimentos Tributáveis'].push({
    //                origem: 'Férias/Gozos',
    //descricao: g.descricao || 'Proventos de Férias',
    //valor: valor,
    //data: g.Pagamento
    //});

    // Acumular IRRF (Mensal/Férias) dos gozos
    //const irValueRaw = g.simplificado === true
    //                ? parseValue(g.irSimplificado)
    //: parseValue(g.irBaseadoEmDeducoes);

    //if (irValueRaw !== 0) {
    //                const irValue = Number(irValueRaw.toFixed(2));
    //aggregated['IRRF (Mensal/Férias)'] += irValue;
    //aggregated.details['IRRF (Mensal/Férias)'].push({
    //                  origem: 'Férias/Gozos',
    //descricao: `IRRF Férias (${g.simplificado === true ? 'Simplificado' : 'Deduções'})`,
    //valor: irValue,
    //data: g.Pagamento
    //});
    //}

    // Acumular INSS dos gozos na Previdência Oficial
    //if (g.inss) {
    //                const inssValue = parseValue(g.inss);
    //if (inssValue !== 0) {
    //                  aggregated['Previdência Oficial'] += inssValue;
    //aggregated.details['Previdência Oficial'].push({
    //                    origem: 'Férias/Gozos',
    //descricao: 'INSS Férias',
    //valor: inssValue,
    //data: g.Pagamento
    //});
    //}
    //}

    // Dedução de Dependentes (Synthetic) - Aplicar apenas uma vez por ano
    //if (!dependentDeductionApplied && Array.isArray(worker.dependentes)) {
    // const fiscalDeps = worker.dependentes.filter(d => d.criterioFiscal);
    //if (fiscalDeps.length > 0) {
    // fiscalDeps.forEach(dep => {
    //  aggregated['13º Salário (Exclusiva)'] -= VALOR_DEDUCAO_DEPENDENTE;
    // aggregated.details['13º Salário (Exclusiva)'].push({
    //  origem: 'Férias/Gozos',
    // descricao: `Dedução Dependente 13º - ${dep.nome}`,
    // valor: -VALOR_DEDUCAO_DEPENDENTE,
    // data: g.Pagamento
    // });
    // });
    //  dependentDeductionApplied = true;
    //  }
    // }
    //       }
    //     });
    //   }
    //  });
    //  }

    // Se não houve gozos (ou não foi aplicada a dedução neles) mas tem 13º salário, aplicar a dedução também
    if (
      aggregated["13º Salário (Exclusiva)"] !== 0 &&
      Array.isArray(worker.dependentes)
    ) {
      const fiscalDeps = worker.dependentes.filter(d => d.criterioFiscal);
      fiscalDeps.forEach(dep => {
        aggregated["13º Salário (Exclusiva)"] -= VALOR_DEDUCAO_DEPENDENTE;
        aggregated.details["13º Salário (Exclusiva)"].push({
          origem: "Apuração Anual",
          descricao: `Dedução Dependente 13º - ${dep.nome}`,
          valor: -VALOR_DEDUCAO_DEPENDENTE,
        });
      });
      dependentDeductionApplied = true;
    }

    return aggregated;
  });
}

/**
 * Exporta os dados agregados para uma planilha Excel
 */
export function exportRendimentosToExcel(
  data: AggregatedWorkerData[],
  year: string
): void {
  // Formata os números para o Excel (duas casas decimais) e remove detalhes
  const formattedData = data.map(row => ({
    matricula: row.matricula,
    nome: row.nome,
    cpf: row.cpf,
    "Rendimentos Tributáveis": Number(
      row["Rendimentos Tributáveis"].toFixed(2)
    ),
    "Previdência Oficial": Number(row["Previdência Oficial"].toFixed(2)),
    "IRRF (Mensal/Férias)": Number(row["IRRF (Mensal/Férias)"].toFixed(2)),
    "Base Cálculo IRRF": Number(row["Base Cálculo IRRF"].toFixed(2)),
    "13º Salário (Exclusiva)": Number(
      row["13º Salário (Exclusiva)"].toFixed(2)
    ),
    "IRRF sobre 13º (Exclusiva)": Number(
      row["IRRF sobre 13º (Exclusiva)"].toFixed(2)
    ),
    "CP 13º Salário": Number(row["CP 13º Salário"].toFixed(2)),
    "PLR (Exclusiva)": Number(row["PLR (Exclusiva)"].toFixed(2)),
    "IRRF sobre PLR (Exclusiva)": Number(
      row["IRRF sobre PLR (Exclusiva)"].toFixed(2)
    ),
    "Desconto Plano de Saúde": Number(
      row["Desconto Plano de Saúde"].toFixed(2)
    ),
    "Rendimentos Isentos": Number(row["Rendimentos Isentos"].toFixed(2)),
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Declaração de Rendimentos"
  );

  // Ajustar largura das colunas
  const colWidths = [
    { wch: 15 }, // matricula
    { wch: 40 }, // nome
    { wch: 15 }, // cpf
    { wch: 30 }, // Rendimentos Tributáveis
    { wch: 25 }, // Previdência Oficial
    { wch: 25 }, // IRRF (Mensal/Férias)
    { wch: 25 }, // Base Cálculo IRRF
    { wch: 25 }, // 13º Salário (Exclusiva)
    { wch: 25 }, // IRRF sobre 13º (Exclusiva)
    { wch: 25 }, // CP 13º Salário
    { wch: 20 }, // PLR (Exclusiva)
    { wch: 25 }, // IRRF sobre PLR (Exclusiva)
    { wch: 25 }, // Desconto Plano de Saúde
    { wch: 25 }, // Rendimentos Isentos
  ];

  worksheet["!cols"] = colWidths;

  const fileName = `declaracao-rendimentos-${year || "processado"}-${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
