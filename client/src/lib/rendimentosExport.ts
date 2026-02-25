/**
 * Utilitários para processamento de Declaração de Rendimentos
 */

import * as XLSX from 'xlsx';

export interface Lancamento {
  codigo: number | string;
  valor: number | string;
  descricao?: string;
  natureza?: string;
}

export interface Contracheque {
  ano: number | string;
  lancamentos: Lancamento[];
  [key: string]: any; // Permite outros campos como valorLiquido, etc.
}

export interface WorkerData {
  matricula: string;
  nome: string;
  cpf: string;
  contracheques: Contracheque[];
}

export interface AggregatedWorkerData {
  matricula: string;
  nome: string;
  cpf: string;
  'Rendimentos Tributáveis': number;
  'Previdência Oficial': number;
  'IRRF (Mensal/Férias)': number;
  '13º Salário (Exclusiva)': number;
  'IRRF sobre 13º (Exclusiva)': number;
  'PLR (Exclusiva)': number;
  'IRRF sobre PLR (Exclusiva)': number;
  'Desconto Plano de Saúde': number;
  'Rendimentos Isentos': number;
}

/**
 * Converte valor monetário (string ou número) para número float.
 * Trata formatos brasileiros como "1.234,56" ou "R$ 1.234,56"
 */
export function parseValue(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;

  // Remove R$, espaços e outros caracteres não numéricos exceto vírgula e ponto
  let cleaned = val.replace(/[^\d.,-]/g, '');

  // Se houver tanto ponto quanto vírgula, o ponto é separador de milhar
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  // Se houver apenas vírgula e ela estiver nas últimas 3 posições, é decimal
  else if (cleaned.includes(',') && (cleaned.indexOf(',') >= cleaned.length - 3)) {
    cleaned = cleaned.replace(',', '.');
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

/**
 * Agrega dados do contracheque para cada trabalhador conforme as regras de códigos e ano
 */
export function aggregateWorkerData(workers: WorkerData[], year: string | number): AggregatedWorkerData[] {
  const targetYear = String(year);

  // Filtrar apenas trabalhadores que possuem pelo menos um contracheque no ano alvo
  const filteredWorkers = workers.filter(worker => {
    return Array.isArray(worker.contracheques) &&
           worker.contracheques.some(cc => cc.ano && String(cc.ano) === targetYear);
  });

  return filteredWorkers.map(worker => {
    const aggregated: AggregatedWorkerData = {
      matricula: String(worker.matricula || ''),
      nome: String(worker.nome || ''),
      cpf: String(worker.cpf || ''),
      'Rendimentos Tributáveis': 0,
      'Previdência Oficial': 0,
      'IRRF (Mensal/Férias)': 0,
      '13º Salário (Exclusiva)': 0,
      'IRRF sobre 13º (Exclusiva)': 0,
      'PLR (Exclusiva)': 0,
      'IRRF sobre PLR (Exclusiva)': 0,
      'Desconto Plano de Saúde': 0,
      'Rendimentos Isentos': 0,
    };

    if (Array.isArray(worker.contracheques)) {
      worker.contracheques.forEach(cc => {
        // Filtrar por ano no nível do contracheque
        if (cc.ano && String(cc.ano) !== targetYear) {
          return;
        }

        if (Array.isArray(cc.lancamentos)) {
          cc.lancamentos.forEach(item => {
            const codigo = String(item.codigo);
            const valor = parseValue(item.valor);

            const rules = {
              rendimentosTributaveis: ['8781', '9380', '19', '150', '207', '229', '244', '249', '250', '805', '806', '8125', '8783', '8784', '8832', '8870', '9180', '9384', '9661'],
              previdenciaOficial: ['998', '843', '812', '821', '826', '858'],
              irrfMensal: ['999', '828', '942', '8128'],
              salario13: ['12', '13', '50', '800', '801', '802', '8104', '8216', '8374', '8550', '8566', '8918', '8919'],
              irrf13: ['804', '827'],
              plr: ['873'],
              irrfPlr: ['874'],
              planoSaude: '8111',
              reembolsoPlanoSaude: '8917',
              rendimentosIsentos: ['931', '932', '8169', '28', '29', '64', '830', '9591', '8800']
            };

            if (rules.rendimentosTributaveis.includes(codigo)) {
              aggregated['Rendimentos Tributáveis'] += valor;
            } else if (rules.previdenciaOficial.includes(codigo)) {
              aggregated['Previdência Oficial'] += valor;
            } else if (rules.irrfMensal.includes(codigo)) {
              aggregated['IRRF (Mensal/Férias)'] += valor;
            } else if (rules.salario13.includes(codigo)) {
              aggregated['13º Salário (Exclusiva)'] += valor;
            } else if (rules.irrf13.includes(codigo)) {
              aggregated['IRRF sobre 13º (Exclusiva)'] += valor;
            } else if (rules.plr.includes(codigo)) {
              aggregated['PLR (Exclusiva)'] += valor;
            } else if (rules.irrfPlr.includes(codigo)) {
              aggregated['IRRF sobre PLR (Exclusiva)'] += valor;
            } else if (codigo === rules.planoSaude) {
              aggregated['Desconto Plano de Saúde'] += valor;
            } else if (codigo === rules.reembolsoPlanoSaude) {
              aggregated['Desconto Plano de Saúde'] -= valor;
            } else if (rules.rendimentosIsentos.includes(codigo)) {
              aggregated['Rendimentos Isentos'] += valor;
            }
          });
        }
      });
    }

    return aggregated;
  });
}

/**
 * Exporta os dados agregados para uma planilha Excel
 */
export function exportRendimentosToExcel(data: AggregatedWorkerData[], year: string): void {
  // Formata os números para o Excel (duas casas decimais)
  const formattedData = data.map(row => ({
    ...row,
    'Rendimentos Tributáveis': Number(row['Rendimentos Tributáveis'].toFixed(2)),
    'Previdência Oficial': Number(row['Previdência Oficial'].toFixed(2)),
    'IRRF (Mensal/Férias)': Number(row['IRRF (Mensal/Férias)'].toFixed(2)),
    '13º Salário (Exclusiva)': Number(row['13º Salário (Exclusiva)'].toFixed(2)),
    'IRRF sobre 13º (Exclusiva)': Number(row['IRRF sobre 13º (Exclusiva)'].toFixed(2)),
    'PLR (Exclusiva)': Number(row['PLR (Exclusiva)'].toFixed(2)),
    'IRRF sobre PLR (Exclusiva)': Number(row['IRRF sobre PLR (Exclusiva)'].toFixed(2)),
    'Desconto Plano de Saúde': Number(row['Desconto Plano de Saúde'].toFixed(2)),
    'Rendimentos Isentos': Number(row['Rendimentos Isentos'].toFixed(2)),
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Declaração de Rendimentos');

  // Ajustar largura das colunas
  const colWidths = [
    { wch: 15 }, // matricula
    { wch: 40 }, // nome
    { wch: 15 }, // cpf
    { wch: 30 }, // Rendimentos Tributáveis
    { wch: 25 }, // Previdência Oficial
    { wch: 25 }, // IRRF (Mensal/Férias)
    { wch: 25 }, // 13º Salário (Exclusiva)
    { wch: 25 }, // IRRF sobre 13º (Exclusiva)
    { wch: 20 }, // PLR (Exclusiva)
    { wch: 25 }, // IRRF sobre PLR (Exclusiva)
    { wch: 25 }, // Desconto Plano de Saúde
    { wch: 25 }, // Rendimentos Isentos
  ];

  worksheet['!cols'] = colWidths;

  const fileName = `declaracao-rendimentos-${year || 'processado'}-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
