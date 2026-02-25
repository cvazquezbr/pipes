/**
 * Utilitários para processamento de Declaração de Rendimentos
 */

import * as XLSX from 'xlsx';

export interface ContrachequeItem {
  codigo: number | string;
  valor: number | string;
  ano?: number | string;
  descricao?: string;
}

export interface WorkerData {
  matricula: string;
  nome: string;
  cpf: string;
  contracheque: ContrachequeItem[];
}

export interface AggregatedWorkerData {
  matricula: string;
  nome: string;
  cpf: string;
  'Total dos rendimentos (inclusive férias)': number;
  'Contribuição previdenciária oficial': number;
  'IRRF': number;
  '13º salário': number;
  'IRRF sobre 13º salário': number;
  'Desconto Plano de Saúde': number;
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

  return workers.map(worker => {
    const aggregated: AggregatedWorkerData = {
      matricula: String(worker.matricula || ''),
      nome: String(worker.nome || ''),
      cpf: String(worker.cpf || ''),
      'Total dos rendimentos (inclusive férias)': 0,
      'Contribuição previdenciária oficial': 0,
      'IRRF': 0,
      '13º salário': 0,
      'IRRF sobre 13º salário': 0,
      'Desconto Plano de Saúde': 0,
    };

    if (Array.isArray(worker.contracheque)) {
      worker.contracheque.forEach(item => {
        // Filtrar por ano
        if (item.ano && String(item.ano) !== targetYear) {
          return;
        }

        const codigo = Number(item.codigo);
        const valor = parseValue(item.valor);

        if (codigo === 8781 || codigo === 9380) {
          aggregated['Total dos rendimentos (inclusive férias)'] += valor;
        } else if (codigo === 998 || codigo === 843) {
          aggregated['Contribuição previdenciária oficial'] += valor;
        } else if (codigo === 999) {
          aggregated['IRRF'] += valor;
        } else if (codigo === 12) {
          aggregated['13º salário'] += valor;
        } else if (codigo === 804) {
          aggregated['IRRF sobre 13º salário'] += valor;
        } else if (codigo === 8111) {
          aggregated['Desconto Plano de Saúde'] += valor;
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
    'Total dos rendimentos (inclusive férias)': Number(row['Total dos rendimentos (inclusive férias)'].toFixed(2)),
    'Contribuição previdenciária oficial': Number(row['Contribuição previdenciária oficial'].toFixed(2)),
    'IRRF': Number(row['IRRF'].toFixed(2)),
    '13º salário': Number(row['13º salário'].toFixed(2)),
    'IRRF sobre 13º salário': Number(row['IRRF sobre 13º salário'].toFixed(2)),
    'Desconto Plano de Saúde': Number(row['Desconto Plano de Saúde'].toFixed(2)),
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Declaração de Rendimentos');

  // Ajustar largura das colunas
  const colWidths = [
    { wch: 15 }, // matricula
    { wch: 40 }, // nome
    { wch: 15 }, // cpf
    { wch: 30 }, // Total dos rendimentos
    { wch: 25 }, // Contribuição previdenciária
    { wch: 15 }, // IRRF
    { wch: 15 }, // 13º salário
    { wch: 25 }, // IRRF sobre 13º
    { wch: 25 }, // Desconto Plano de Saúde
  ];

  worksheet['!cols'] = colWidths;

  const fileName = `declaracao-rendimentos-${year || 'processado'}-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
