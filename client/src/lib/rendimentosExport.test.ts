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
  });
});
