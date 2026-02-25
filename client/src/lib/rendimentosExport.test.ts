import { describe, it, expect } from 'vitest';
import { aggregateWorkerData, WorkerData } from './rendimentosExport';

describe('rendimentosExport', () => {
  it('should correctly aggregate worker data based on codes', () => {
    const workers: WorkerData[] = [
      {
        matricula: '123',
        nome: 'João Silva',
        cpf: '111.222.333-44',
        contracheque: [
          { codigo: 8781, valor: 1000.50 }, // Rendimentos
          { codigo: 9380, valor: 500.00 },  // Rendimentos
          { codigo: 998, valor: 100.00 },   // Prev Oficial
          { codigo: 843, valor: 50.00 },    // Prev Oficial
          { codigo: 999, valor: 200.00 },   // IRRF
          { codigo: 12, valor: 1200.00 },   // 13º Salário
          { codigo: 804, valor: 120.00 },   // IRRF sobre 13º
          { codigo: 8111, valor: 80.00 },   // Plano Saúde
          { codigo: 9999, valor: 10000.00 }, // Outro código (ignorar)
        ]
      },
      {
        matricula: '456',
        nome: 'Maria Souza',
        cpf: '555.666.777-88',
        contracheque: [
          { codigo: '8781', valor: '2000,00' }, // Rendimentos (string format)
          { codigo: 998, valor: 200.00 },        // Prev Oficial
        ]
      }
    ];

    const aggregated = aggregateWorkerData(workers);

    expect(aggregated).toHaveLength(2);

    expect(aggregated[0]).toEqual({
      matricula: '123',
      nome: 'João Silva',
      cpf: '111.222.333-44',
      'Total dos rendimentos (inclusive férias)': 1500.50,
      'Contribuição previdenciária oficial': 150.00,
      'IRRF': 200.00,
      '13º salário': 1200.00,
      'IRRF sobre 13º salário': 120.00,
      'Desconto Plano de Saúde': 80.00,
    });

    expect(aggregated[1]).toEqual({
      matricula: '456',
      nome: 'Maria Souza',
      cpf: '555.666.777-88',
      'Total dos rendimentos (inclusive férias)': 2000.00,
      'Contribuição previdenciária oficial': 200.00,
      'IRRF': 0,
      '13º salário': 0,
      'IRRF sobre 13º salário': 0,
      'Desconto Plano de Saúde': 0,
    });
  });
});
