/**
 * Utilitários comuns para cálculos de impostos
 */

/**
 * Arredondamento padrão para 2 casas decimais (compatível com round2 do R)
 */
export function round2(x: number, digits: number = 2): number {
  if (x === undefined || x === null || isNaN(x)) return 0;
  if (Math.abs(x) < 0.0000000001) return 0;
  const factor = Math.pow(10, digits);
  // Usamos Math.sign * Math.round(Math.abs) para garantir arredondamento simétrico (away from zero)
  return Math.sign(x) * Math.round(Math.abs(x) * factor) / factor;
}

/**
 * Converte valor para número, tratando formatos brasileiros
 */
export function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value === undefined || value === null || value === '') return 0;

  let str = String(value).trim();
  if (str === '' || str === '-') return 0;

  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Busca valor em um objeto por múltiplas chaves possíveis (case-insensitive e flexível com separadores)
 */
export function getVal(row: Record<string, unknown>, ...keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key];

    const normalizedTarget = key.toLowerCase().replace(/[._\s]/g, '');
    for (const rowKey of Object.keys(row)) {
      const normalizedRowKey = rowKey.toLowerCase().replace(/[._\s]/g, '');
      if (normalizedRowKey === normalizedTarget && row[rowKey] !== undefined && row[rowKey] !== '') {
        return row[rowKey];
      }
    }
  }
  return undefined;
}

/**
 * Converte valor da planilha de referência para número (porcentagem)
 */
export function parseReferenceValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value === undefined || value === null || value === '') return 0;

  const str = String(value).trim();
  const hasPercent = str.includes('%');
  const cleaned = str.replace('%', '').replace(/\s/g, '');

  let val: number;
  if (cleaned.includes(',')) {
    if (cleaned.includes('.')) {
      val = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      val = parseFloat(cleaned.replace(',', '.')) || 0;
    }
  } else {
    val = parseFloat(cleaned) || 0;
  }

  return hasPercent ? val / 100 : val;
}

/**
 * Normaliza strings para comparação (remove acentos, espaços extras e caracteres especiais)
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, ''); // Mantém apenas alfanuméricos
}

/**
 * Tenta obter o percentual de uma linha de mapeamento
 */
export function getMappingPercentage(mapping: any): number {
  const rawPercent = mapping['Item Tax1 %_1'] !== undefined && mapping['Item Tax1 %_1'] !== ''
    ? mapping['Item Tax1 %_1']
    : mapping['Item Tax1 %2'] !== undefined && mapping['Item Tax1 %2'] !== ''
      ? mapping['Item Tax1 %2']
      : mapping['Item Tax1 %'];

  return parseReferenceValue(rawPercent);
}

/**
 * Encontra o mapeamento de imposto mais próximo
 */
export function findTaxMapping(
  retentionPercentage: number,
  taxMappings: any[],
  itemTaxName: string
): any {
  if (taxMappings.length === 0) return null;

  const normalizedItemTaxName = normalizeString(itemTaxName);

  // 1. Tenta por nome primeiro (comparação exata após trim)
  let match = taxMappings.find(m => {
    const mName = String(getVal(m, 'Item Tax', 'Item Tax1') || '').trim();
    return mName.toLowerCase() === itemTaxName.trim().toLowerCase();
  });

  if (match) return match;

  // 2. Tenta por nome normalizado
  match = taxMappings.find(m => {
    const mName = String(getVal(m, 'Item Tax', 'Item Tax1') || '').trim();
    return normalizeString(mName) === normalizedItemTaxName && normalizedItemTaxName !== '';
  });

  if (match) return match;

  // 3. Fallback para percentual
  const closest = taxMappings.reduce((prev, curr) => {
    let currPercent = getMappingPercentage(curr);
    let prevPercent = getMappingPercentage(prev);

    if (currPercent < 1 && retentionPercentage > 1 && currPercent !== 0) currPercent *= 100;
    if (prevPercent < 1 && retentionPercentage > 1 && prevPercent !== 0) prevPercent *= 100;

    return Math.abs(currPercent - retentionPercentage) < Math.abs(prevPercent - retentionPercentage)
      ? curr
      : prev;
  });

  return closest;
}

/**
 * Calcula período alvo e datas de vencimento padrão
 */
export function calculateDates() {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() - 20);

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1; // 1-12
  const monthStr = String(month).padStart(2, '0');
  const periodD = `${year}-${monthStr}`;

  // Datas de pagamento (mês seguinte ao alvo)
  const nextMonthDate = new Date(year, month, 1);
  const nextYear = nextMonthDate.getFullYear();
  const nextMonth = nextMonthDate.getMonth() + 1;
  const nextMonthStr = String(nextMonth).padStart(2, '0');

  return {
    periodD,
    dataCOFINS: `24/${nextMonthStr}/${nextYear}`,
    dataPIS: `24/${nextMonthStr}/${nextYear}`,
    dataISS: `19/${nextMonthStr}/${nextYear}`,
    dataIRPJ: `20/${nextMonthStr}/${nextYear}`, // Exemplo, IRPJ Trimestral pode variar
    dataCSLL: `20/${nextMonthStr}/${nextYear}`,
    year,
    monthStr
  };
}
