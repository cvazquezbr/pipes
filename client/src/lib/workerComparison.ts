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
    if (JSON.stringify(oldWorker[field]) !== JSON.stringify(newWorker[field])) {
      changes.push({
        field,
        label: HR_DICTIONARY[field] || field,
        oldValue: oldWorker[field],
        newValue: newWorker[field],
      });
    }
  });

  // Campos complexos (arrays) - simplificado para detectar mudança bruta
  const complexFields = ["contracheques", "periodosAquisitivos", "dependentes"];
  complexFields.forEach(field => {
    if (JSON.stringify(oldWorker[field]) !== JSON.stringify(newWorker[field])) {
      const countOld = Array.isArray(oldWorker[field]) ? oldWorker[field].length : 0;
      const countNew = Array.isArray(newWorker[field]) ? newWorker[field].length : 0;

      let oldVal = `${countOld} registros`;
      let newVal = `${countNew} registros`;

      if (countOld === countNew) {
        oldVal += " (versão anterior)";
        newVal += " (dados atualizados)";
      }

      changes.push({
        field,
        label: HR_DICTIONARY[field] || field,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  });

  return changes;
}
