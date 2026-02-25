import { describe, it, expect } from 'vitest';
import { aggregateWorkerData, WorkerData, parseValue } from './rendimentosExport';

describe('rendimentosExport', () => {
  describe('parseValue', () => {
    it('should parse Brazilian format numbers correctly', () => {
      expect(parseValue('1.234,56')).toBe(1234.56);
      expect(parseValue('R$ 1.234,56')).toBe(1234.56);
      expect(parseValue('1234,56')).toBe(1234.56);
      expect(parseValue('1234.56')).toBe(1234.56);
      expect(parseValue(100.5)).toBe(100.5);
      expect(parseValue('1.234.567,89')).toBe(1234567.89);
      expect(parseValue('1,00')).toBe(1);
    });
  });

  describe('aggregateWorkerData', () => {
    it('should correctly aggregate worker data and filter by year in the new structure', () => {
      const workers: WorkerData[] = [
        {
          matricula: '123',
          nome: 'João Silva',
          cpf: '111.222.333-44',
          contracheques: [
            {
              ano: 2025,
              lancamentos: [
                { codigo: 8781, valor: '1.000,50' }, // Rendimentos Tributáveis
                { codigo: 9380, valor: 500.00 },      // Rendimentos Tributáveis
                { codigo: 999, valor: '200,00' },     // IRRF (Mensal/Férias)
                { codigo: 12, valor: '1.200,00' },    // 13º Salário (Exclusiva)
                { codigo: 8111, valor: '300,00' },    // Plano de Saúde
                { codigo: 8917, valor: '50,00' },     // Reembolso Plano de Saúde
                { codigo: 931, valor: '100,00' },     // Rendimentos Isentos
                { codigo: 873, valor: '1000,00' },    // PLR
                { codigo: 874, valor: '150,00' },     // IRRF PLR
              ]
            },
            {
              ano: 2024,
              lancamentos: [
                { codigo: 998, valor: '100,00' },     // Wrong year (Previdência)
              ]
            }
          ]
        }
      ];

      const aggregated = aggregateWorkerData(workers, '2025');

      expect(aggregated).toHaveLength(1);
      expect(aggregated[0]).toEqual({
        matricula: '123',
        nome: 'João Silva',
        cpf: '111.222.333-44',
        'Rendimentos Tributáveis': 1500.50,
        'Previdência Oficial': 0, // Code 998 was in 2024
        'IRRF (Mensal/Férias)': 200.00,
        '13º Salário (Exclusiva)': 1200.00,
        'IRRF sobre 13º (Exclusiva)': 0,
        'PLR (Exclusiva)': 1000.00,
        'IRRF sobre PLR (Exclusiva)': 150.00,
        'Desconto Plano de Saúde': 250.00, // 300 - 50
        'Rendimentos Isentos': 100.00,
      });
    });

    it('should aggregate from multiple paychecks of the same year', () => {
        const workers: WorkerData[] = [
          {
            matricula: '456',
            nome: 'Maria Souza',
            cpf: '555.666.777-88',
            contracheques: [
              {
                ano: 2025,
                lancamentos: [{ codigo: '8781', valor: 1000 }]
              },
              {
                ano: 2025,
                lancamentos: [{ codigo: '8781', valor: 1000 }]
              }
            ]
          }
        ];

        const aggregated = aggregateWorkerData(workers, 2025);
        expect(aggregated[0]['Rendimentos Tributáveis']).toBe(2000);
      });
  });
});
