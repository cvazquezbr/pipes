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
      expect(aggregated[0]).toMatchObject({
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

    it('should correctly include proventos from gozos filtered by payment year', () => {
      const workers: WorkerData[] = [
        {
          matricula: '789',
          nome: 'Carlos Oliveira',
          cpf: '999.888.777-66',
          contracheques: [
            {
              ano: 2025,
              lancamentos: [{ codigo: '8781', valor: 1000 }]
            }
          ],
          periodosAquisitivos: [
            {
              gozos: [
                {
                  proventos: '500,00',
                  Pagamento: '2025-05-15',
                  descricao: 'Ferias Maio'
                },
                {
                  proventos: '600,00',
                  Pagamento: '2024-12-20',
                  descricao: 'Ferias Dezembro'
                }
              ]
            }
          ]
        }
      ];

      const aggregated = aggregateWorkerData(workers, '2025');

      expect(aggregated).toHaveLength(1);
      // 1000 (contracheque) + 500 (gozo 2025) = 1500
      // 600 (gozo 2024) should be ignored
      expect(aggregated[0]['Rendimentos Tributáveis']).toBe(1500);

      // Verify details
      const details = aggregated[0].details['Rendimentos Tributáveis'];
      expect(details).toHaveLength(2);
      expect(details.some(d => d.origem === 'Férias/Gozos' && d.valor === 500)).toBe(true);
      expect(details.some(d => d.origem.startsWith('Contracheque') && d.valor === 1000)).toBe(true);
    });

    it('should correctly include IRRF from gozos based on simplificado flag and round values', () => {
      const workers: WorkerData[] = [
        {
          matricula: '101',
          nome: 'Juliana Lima',
          cpf: '222.333.444-55',
          contracheques: [],
          periodosAquisitivos: [
            {
              gozos: [
                {
                  proventos: '1000,00',
                  Pagamento: '2025-01-10',
                  simplificado: true,
                  irSimplificado: 494.44000000000005,
                  irBaseadoEmDeducoes: 389.69
                },
                {
                  proventos: '1000,00',
                  Pagamento: '2025-02-10',
                  simplificado: false,
                  irSimplificado: 494.44,
                  irBaseadoEmDeducoes: 389.69000000000005
                }
              ]
            }
          ]
        }
      ];

      const aggregated = aggregateWorkerData(workers, '2025');

      expect(aggregated).toHaveLength(1);
      // IRRF (Mensal/Férias) should be:
      // Gozo 1 (simplificado: true) -> irSimplificado (494.44)
      // Gozo 2 (simplificado: false) -> irBaseadoEmDeducoes (389.69)
      // Total = 494.44 + 389.69 = 884.13
      expect(aggregated[0]['IRRF (Mensal/Férias)']).toBeCloseTo(884.13, 2);

      const irDetails = aggregated[0].details['IRRF (Mensal/Férias)'];
      expect(irDetails).toHaveLength(2);
      expect(irDetails[0].valor).toBe(494.44);
      expect(irDetails[0].descricao).toContain('Simplificado');
      expect(irDetails[1].valor).toBe(389.69);
      expect(irDetails[1].descricao).toContain('Deduções');
    });

    it('should correctly include inss from gozos in Previdência Oficial', () => {
      const workers: WorkerData[] = [
        {
          matricula: '202',
          nome: 'Roberto Dias',
          cpf: '333.444.555-66',
          contracheques: [],
          periodosAquisitivos: [
            {
              gozos: [
                {
                  proventos: '1000,00',
                  Pagamento: '2025-03-10',
                  inss: '150,50'
                },
                {
                  proventos: '1000,00',
                  Pagamento: '2025-04-10',
                  inss: 200.25
                }
              ]
            }
          ]
        }
      ];

      const aggregated = aggregateWorkerData(workers, '2025');

      expect(aggregated).toHaveLength(1);
      // Previdência Oficial should be: 150.50 + 200.25 = 350.75
      expect(aggregated[0]['Previdência Oficial']).toBe(350.75);

      const inssDetails = aggregated[0].details['Previdência Oficial'];
      expect(inssDetails).toHaveLength(2);
      expect(inssDetails[0].valor).toBe(150.50);
      expect(inssDetails[0].descricao).toBe('INSS Férias');
      expect(inssDetails[1].valor).toBe(200.25);
      expect(inssDetails[1].descricao).toBe('INSS Férias');
    });

    it('should deduct IRRF 13 (804, 827, 825) from 13º Salário (Exclusiva) in paychecks', () => {
      const workers: WorkerData[] = [
        {
          matricula: '303',
          nome: 'Alice Santos',
          cpf: '111.111.111-11',
          contracheques: [
            {
              ano: 2025,
              lancamentos: [
                { codigo: '12', valor: 5000 },    // Gross 13th
                { codigo: '804', valor: 200 },   // IRRF 13
                { codigo: '825', valor: 150 },   // New IRRF 13 code
              ]
            }
          ]
        }
      ];

      const aggregated = aggregateWorkerData(workers, 2025);
      // 5000 - 200 - 150 = 4650
      expect(aggregated[0]['13º Salário (Exclusiva)']).toBe(4650);
      expect(aggregated[0]['IRRF sobre 13º (Exclusiva)']).toBe(350);

      const details = aggregated[0].details['13º Salário (Exclusiva)'];
      expect(details.some(d => d.valor === -200 && d.descricao?.includes('Dedução'))).toBe(true);
      expect(details.some(d => d.valor === -150 && d.descricao?.includes('Dedução'))).toBe(true);
    });

    it('should deduct dependent values and IRRF 13 from 13º Salário during gozos processing', () => {
      const workers: WorkerData[] = [
        {
          matricula: '404',
          nome: 'Bruno Lima',
          cpf: '222.222.222-22',
          contracheques: [
            {
              ano: 2025,
              lancamentos: [{ codigo: '12', valor: 3000 }] // Initial 13th
            }
          ],
          dependentes: [
            { nome: 'Dep 1', criterioFiscal: true },
            { nome: 'Dep 2', criterioFiscal: true },
            { nome: 'Dep 3', criterioFiscal: false },
          ],
          periodosAquisitivos: [
            {
              gozos: [
                {
                  proventos: 0,
                  Pagamento: '2025-06-15',
                  lancamentos: [
                    { codigo: '827', valor: 100 } // IRRF 13 in gozo
                  ]
                }
              ]
            }
          ]
        }
      ];

      const aggregated = aggregateWorkerData(workers, 2025);
      // Base: 3000
      // IRRF 13 deduction: -100
      // Dependents (2 fiscal): -189.90 * 2 = -379.80
      // Total: 3000 - 100 - 379.80 = 2520.20
      expect(aggregated[0]['13º Salário (Exclusiva)']).toBeCloseTo(2520.20, 2);

      const details = aggregated[0].details['13º Salário (Exclusiva)'];
      expect(details.some(d => d.valor === -100 && d.origem === 'Férias/Gozos')).toBe(true);
      expect(details.filter(d => d.valor === -189.90 && d.descricao?.includes('Dedução Dependente'))).toHaveLength(2);
    });

    it('should not duplicate dependent deduction if there are multiple gozos', () => {
      const workers: WorkerData[] = [
        {
          matricula: '505',
          nome: 'Clara Nunes',
          cpf: '333.333.333-33',
          contracheques: [
            {
              ano: 2025,
              lancamentos: [{ codigo: '12', valor: 4000 }]
            }
          ],
          dependentes: [{ nome: 'Filho', criterioFiscal: true }],
          periodosAquisitivos: [
            {
              gozos: [
                { proventos: 0, Pagamento: '2025-01-10' },
                { proventos: 0, Pagamento: '2025-07-20' }
              ]
            }
          ]
        }
      ];

      const aggregated = aggregateWorkerData(workers, 2025);
      // 4000 - 189.90 = 3810.10
      expect(aggregated[0]['13º Salário (Exclusiva)']).toBeCloseTo(3810.10, 2);
      const details = aggregated[0].details['13º Salário (Exclusiva)'];
      expect(details.filter(d => d.valor === -189.90)).toHaveLength(1);
    });

    it('should apply dependent deduction even if there are no gozos but there is 13th salary', () => {
      const workers: WorkerData[] = [
        {
          matricula: '606',
          nome: 'Daniel Silva',
          cpf: '444.444.444-44',
          contracheques: [
            {
              ano: 2025,
              lancamentos: [{ codigo: '12', valor: 2000 }]
            }
          ],
          dependentes: [{ nome: 'Filho', criterioFiscal: true }]
        }
      ];

      const aggregated = aggregateWorkerData(workers, 2025);
      // 2000 - 189.90 = 1810.10
      expect(aggregated[0]['13º Salário (Exclusiva)']).toBeCloseTo(1810.10, 2);
      const details = aggregated[0].details['13º Salário (Exclusiva)'];
      expect(details.some(d => d.valor === -189.90 && d.origem === 'Apuração Anual')).toBe(true);
    });
  });
});
