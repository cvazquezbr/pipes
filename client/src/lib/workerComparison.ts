/**
 * Dicionário de mapeamento de campos do JSON para termos de Gestão de Pessoas (RH)
 */
export const HR_DICTIONARY: Record<string, string> = {
  nome: "Nome Completo do Colaborador",
  cpf: "Cadastro de Pessoa Física (CPF)",
  matricula: "Número de Matrícula Funcional",
  contracheques: "Histórico Mensal de Pagamentos (Contracheques)",
  periodosAquisitivos: "Histórico de Períodos de Aquisição de Férias",
  dependentes: "Dependentes para Fins de IRRF/Benefícios",
  ano: "Ano Civil de Referência",
  dataPagamento: "Data Efetiva do Crédito em Conta",
  nomeFolha: "Classificação da Folha de Pagamento",
  lancamentos: "Detalhamento de Verbas (Lançamentos Financeiros)",
  codigo: "Código Identificador da Rúbrica",
  descricao: "Nome/Descrição da Verba Salarial",
  tipo: "Natureza da Verba (Provento ou Desconto)",
  valor: "Valor Monetário da Operação",
  gozos: "Períodos de Fruição (Gozo) de Férias",
  Pagamento: "Data de Pagamento do Recibo de Férias",
  Inicio: "Data de Início do Afastamento por Férias",
  proventos: "Soma Total de Proventos no Período",
  descontos: "Soma Total de Descontos no Período",
  criterioFiscal: "Indicador de Elegibilidade para Dedução de IRRF",
};

/**
 * Representa uma mudança em um campo específico
 */
export interface FieldChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

/**
 * Representa mudanças em um trabalhador
 */
export interface WorkerChange {
  matricula: string;
  nome: string;
  type: "added" | "removed" | "modified";
  fieldChanges?: FieldChange[];
}

/**
 * Relatório final da comparação
 */
export interface ComparisonReport {
  added: number;
  removed: number;
  modified: number;
  changes: WorkerChange[];
}

/**
 * Compara dois conjuntos de dados de trabalhadores e gera um relatório
 */
export function compareWorkers(
  oldData: any[],
  newData: any[]
): ComparisonReport {
  const oldMap = new Map(oldData.map(w => [String(w.matricula), w]));
  const newMap = new Map(newData.map(w => [String(w.matricula), w]));

  const report: ComparisonReport = {
    added: 0,
    removed: 0,
    modified: 0,
    changes: [],
  };

  // Detectar Novos e Modificados
  newData.forEach(newWorker => {
    const matricula = String(newWorker.matricula);
    const oldWorker = oldMap.get(matricula);

    if (!oldWorker) {
      report.added++;
      report.changes.push({
        matricula,
        nome: newWorker.nome,
        type: "added",
      });
    } else {
      const fieldChanges = getFieldChanges(oldWorker, newWorker);
      if (fieldChanges.length > 0) {
        report.modified++;
        report.changes.push({
          matricula,
          nome: newWorker.nome,
          type: "modified",
          fieldChanges,
        });
      }
    }
  });

  // Detectar Removidos
  oldData.forEach(oldWorker => {
    const matricula = String(oldWorker.matricula);
    if (!newMap.has(matricula)) {
      report.removed++;
      report.changes.push({
        matricula,
        nome: oldWorker.nome,
        type: "removed",
      });
    }
  });

  return report;
}

/**
 * Compara dois objetos de trabalhador e retorna a lista de campos alterados
 */
function getFieldChanges(oldWorker: any, newWorker: any): FieldChange[] {
  const changes: FieldChange[] = [];

  // Campos básicos (string, number)
  const basicFields = ["nome", "cpf"];
  basicFields.forEach(field => {
    let oldVal = oldWorker[field];
    let newVal = newWorker[field];

    // Normalização para evitar falsos positivos
    if (field === "cpf") {
      const normalizeCpf = (v: any) => String(v || "").replace(/\D/g, "");
      if (normalizeCpf(oldVal) === normalizeCpf(newVal)) return;
    } else if (field === "nome") {
      const normalizeName = (v: any) => String(v || "").trim().toUpperCase();
      if (normalizeName(oldVal) === normalizeName(newVal)) return;
    } else {
      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return;
    }

    changes.push({
      field,
      label: HR_DICTIONARY[field] || field,
      oldValue: oldVal,
      newValue: newVal,
    });
  });

  // Campos complexos (arrays)
  if (JSON.stringify(oldWorker.dependentes) !== JSON.stringify(newWorker.dependentes)) {
    changes.push(...compareDependentes(oldWorker.dependentes || [], newWorker.dependentes || []));
  }

  if (JSON.stringify(oldWorker.contracheques) !== JSON.stringify(newWorker.contracheques)) {
    changes.push(...compareContracheques(oldWorker.contracheques || [], newWorker.contracheques || []));
  }

  if (JSON.stringify(oldWorker.periodosAquisitivos) !== JSON.stringify(newWorker.periodosAquisitivos)) {
    changes.push(...comparePeriodosAquisitivos(oldWorker.periodosAquisitivos || [], newWorker.periodosAquisitivos || []));
  }

  return changes;
}

function compareDependentes(oldDeps: any[], newDeps: any[]): FieldChange[] {
  const changes: FieldChange[] = [];
  const oldMap = new Map(oldDeps.map(d => [d.nome, d]));
  const newMap = new Map(newDeps.map(d => [d.nome, d]));

  newDeps.forEach(nd => {
    const od = oldMap.get(nd.nome);
    if (!od) {
      changes.push({
        field: "dependentes",
        label: "Novo Dependente",
        oldValue: "-",
        newValue: `${nd.nome} (Fiscal: ${nd.criterioFiscal ? "Sim" : "Não"})`,
      });
    } else if (od.criterioFiscal !== nd.criterioFiscal) {
      changes.push({
        field: "dependentes",
        label: `Dependente: ${nd.nome}`,
        oldValue: `Criterio Fiscal: ${od.criterioFiscal ? "Sim" : "Não"}`,
        newValue: `Criterio Fiscal: ${nd.criterioFiscal ? "Sim" : "Não"}`,
      });
    }
  });

  oldDeps.forEach(od => {
    if (!newMap.has(od.nome)) {
      changes.push({
        field: "dependentes",
        label: "Dependente Removido",
        oldValue: od.nome,
        newValue: "-",
      });
    }
  });

  return changes;
}

function compareContracheques(oldCCs: any[], newCCs: any[]): FieldChange[] {
  const changes: FieldChange[] = [];
  const getCCKey = (cc: any) => `${cc.ano}-${cc.nomeFolha}-${cc.dataPagamento}`;

  const oldMap = new Map(oldCCs.map(cc => [getCCKey(cc), cc]));
  const newMap = new Map(newCCs.map(cc => [getCCKey(cc), cc]));

  newCCs.forEach(ncc => {
    const key = getCCKey(ncc);
    const occ = oldMap.get(key);
    const label = `${ncc.nomeFolha} (${ncc.ano})`;

    if (!occ) {
      changes.push({
        field: "contracheques",
        label: `Novo Contracheque: ${label}`,
        oldValue: "-",
        newValue: `Pago em ${ncc.dataPagamento}`,
      });
    } else if (JSON.stringify(occ.lancamentos) !== JSON.stringify(ncc.lancamentos)) {
      const oldVal = occ.lancamentos?.length || 0;
      const newVal = ncc.lancamentos?.length || 0;

      let oldDesc = `${oldVal} lançamentos`;
      let newDesc = `${newVal} lançamentos`;

      if (oldVal === newVal) {
        oldDesc += " (versão anterior)";
        newDesc += " (dados atualizados)";

        // Tentar identificar se mudou algum valor específico
        const oldTotal = (occ.lancamentos || []).reduce((acc: number, l: any) => acc + (Number(l.valor) || 0), 0);
        const newTotal = (ncc.lancamentos || []).reduce((acc: number, l: any) => acc + (Number(l.valor) || 0), 0);

        if (oldTotal !== newTotal) {
          oldDesc = `Total: R$ ${oldTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
          newDesc = `Total: R$ ${newTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }
      }

      changes.push({
        field: "contracheques",
        label: `Alteração no Contracheque: ${label}`,
        oldValue: oldDesc,
        newValue: newDesc,
      });
    }
  });

  oldCCs.forEach(occ => {
    if (!newMap.has(getCCKey(occ))) {
      changes.push({
        field: "contracheques",
        label: "Contracheque Removido",
        oldValue: `${occ.nomeFolha} (${occ.ano})`,
        newValue: "-",
      });
    }
  });

  return changes;
}

function comparePeriodosAquisitivos(oldPAs: any[], newPAs: any[]): FieldChange[] {
  const changes: FieldChange[] = [];

  // Períodos aquisitivos são complexos pois não tem ID óbvio além do conteúdo dos gozos
  // Vamos comparar pela contagem total de gozos em todos os períodos
  const oldGozosCount = oldPAs.reduce((acc, pa) => acc + (pa.gozos?.length || 0), 0);
  const newGozosCount = newPAs.reduce((acc, pa) => acc + (pa.gozos?.length || 0), 0);

  if (oldGozosCount !== newGozosCount) {
    changes.push({
      field: "periodosAquisitivos",
      label: HR_DICTIONARY.periodosAquisitivos,
      oldValue: `${oldGozosCount} períodos de gozo`,
      newValue: `${newGozosCount} períodos de gozo`,
    });
  } else if (JSON.stringify(oldPAs) !== JSON.stringify(newPAs)) {
    changes.push({
      field: "periodosAquisitivos",
      label: HR_DICTIONARY.periodosAquisitivos,
      oldValue: "Dados de férias anteriores",
      newValue: "Dados de férias atualizados",
    });
  }

  return changes;
}
