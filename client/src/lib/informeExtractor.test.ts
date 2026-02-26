import { parseInformeText } from './informeExtractor';
import { describe, it, expect, vi } from 'vitest';

// Mock pdfjsLib to avoid ReferenceError: DOMMatrix is not defined in node environment
vi.mock('pdfjs-dist', () => ({
  default: {},
  GlobalWorkerOptions: {
    workerSrc: ''
  }
}));

describe('informeExtractor', () => {
  it('should parse a single informe correctly', () => {
    const text = `
      ...
      Nome Completo: JOAO DA SILVA - 12345
      ...
      1. Total dos rendimentos (inclusive férias) 100.250,50
      2. Contribuição previdenciária oficial 11.000,00
      ...
      5. Imposto sobre a Renda Retido na Fonte (IRRF) 5.500,75
      ...
      1. 13º (décimo terceiro) salário 8.000,00
      2. Imposto sobre a Renda Retido na Fonte sobre 13º (décimo terceiro) salário 1.200,00
      3. Outros.Participação de lucros 2.500,00
      ...
      Beneficiário do Plano de Saúde: UNIMED Valor Pago: 1.500,00
      Beneficiário do Plano de Saúde: ODONTOPREV Valor Pago: 200,00
    `;

    const result = parseInformeText(text);
    expect(result).toHaveLength(1);
    expect(result[0].matricula).toBe('12345');
    expect(result[0].nome).toBe('JOAO DA SILVA');
    expect(result[0].totalRendimentos).toBe(100250.5);
    expect(result[0].previdenciaOficial).toBe(11000);
    expect(result[0].irrf).toBe(5500.75);
    expect(result[0].decimoTerceiro).toBe(8000);
    expect(result[0].irrfDecimoTerceiro).toBe(1200);
    expect(result[0].plr).toBe(2500);
    expect(result[0].planoSaude).toHaveLength(2);
    expect(result[0].planoSaude[0].beneficiario).toBe('UNIMED');
    expect(result[0].planoSaude[0].valor).toBe(1500);
  });

  it('should parse multiple informes correctly', () => {
    const text = `
      Nome Completo: JOAO DA SILVA - 12345
      1. Total dos rendimentos (inclusive férias) 10.000,00
      Nome Completo: MARIA SOUZA - 67890
      1. Total dos rendimentos (inclusive férias) 20.000,00
    `;

    const result = parseInformeText(text);
    expect(result).toHaveLength(2);
    expect(result[0].matricula).toBe('12345');
    expect(result[0].totalRendimentos).toBe(10000);
    expect(result[1].matricula).toBe('67890');
    expect(result[1].totalRendimentos).toBe(20000);
  });
});
