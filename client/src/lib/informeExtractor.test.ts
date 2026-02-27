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

  it('should parse with different hyphens and colon variations', () => {
    const texts = [
      'Nome Completo: JOAO DA SILVA - 12345\n1. Total dos rendimentos 100,00',
      'Nome Completo:JOAO DA SILVA-12345\n1. Total dos rendimentos 100,00',
      'Nome Completo : JOAO DA SILVA – 12345\n1. Total dos rendimentos 100,00', // en dash
      'Nome Completo; JOAO DA SILVA — 12345\n1. Total dos rendimentos 100,00', // em dash
    ];

    texts.forEach(t => {
      const result = parseInformeText(t);
      expect(result, `Failed for: ${t}`).toHaveLength(1);
      expect(result[0].matricula).toBe('12345');
      expect(result[0].nome).toBe('JOAO DA SILVA');
      expect(result[0].totalRendimentos).toBe(100);
    });
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

  it('should parse values appearing before rubrics (user snippet)', () => {
    const text = `
      1. Fonte Pagadora Pessoa Jurídica ou Pessoa Física Nome Empresarial / Nome Completo CNPJ/CPF 02.434.797/0001-60 FATTO CONSULTORIA E SISTEMAS LTDA
      2. Pessoa Física Beneficiária dos Rendimentos CPF Nome Completo - 000155 935.016.503-10 AGNALDO CORREIA DOS SANTOS
      Natureza do Rendimento RENDIMENTO DO TRABALHO ASSALARIADO NO PAÍS
      3. Rendimentos Tributáveis, Deduções e Imposto sobre a Renda Retido na Fonte Valores em Reais
      78.609,11 1. Total dos rendimentos (inclusive férias).
      8.934,37 2. Contribuição previdenciária oficial.
      0,00 5. Imposto sobre a Renda Retido na Fonte (IRRF).
    `;

    const result = parseInformeText(text);
    expect(result).toHaveLength(1);
    expect(result[0].matricula).toBe('000155');
    expect(result[0].nome).toBe('AGNALDO CORREIA DOS SANTOS');
    expect(result[0].totalRendimentos).toBe(78609.11);
    expect(result[0].previdenciaOficial).toBe(8934.37);
    expect(result[0].irrf).toBe(0);
  });

  it('should filter out workers with no financial data', () => {
    const text = `
      Nome Completo: TRABALHADOR SEM DADOS - 02
      1. Total dos rendimentos 0,00
      2. Contribuição previdenciária 0,00

      Nome Completo: TRABALHADOR COM DADOS - 03
      1. Total dos rendimentos 1.000,00
    `;

    const result = parseInformeText(text);
    expect(result).toHaveLength(1);
    expect(result[0].matricula).toBe('03');
    expect(result[0].nome).toBe('TRABALHADOR COM DADOS');
  });
});
