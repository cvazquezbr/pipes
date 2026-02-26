import { parseInformeText } from './informeExtractor';
import { aggregateWorkerData } from './rendimentosExport';
import { describe, it, expect, vi } from 'vitest';

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => ({
  default: {},
  GlobalWorkerOptions: {
    workerSrc: ''
  }
}));

describe('Full Workflow Integration Simulation', () => {
  it('should match JSON data with PDF extracted data', () => {
    // 1. Mock JSON Data
    const mockWorkers = [
      {
        matricula: '12345',
        nome: 'JOAO DA SILVA',
        cpf: '111.222.333-44',
        contracheques: [
          {
            ano: '2024',
            nomeFolha: 'MENSAL',
            baseCalculoIrrf: '10.000,00',
            lancamentos: [
              { codigo: '8781', valor: '10.000,00', descricao: 'Salario' }, // Rendimentos Tributáveis
              { codigo: '812', valor: '1.000,00', descricao: 'INSS' },      // Previdência Oficial
              { codigo: '999', valor: '500,00', descricao: 'IRRF' },       // IRRF
              { codigo: '12', valor: '8.000,00', descricao: '13o' },       // 13o
              { codigo: '804', valor: '1.200,00', descricao: 'IRRF 13' },  // IRRF 13
            ]
          }
        ]
      }
    ];

    // 2. Mock PDF Text
    const pdfText = `
      Nome Completo: JOAO DA SILVA - 12345
      1. Total dos rendimentos (inclusive férias) 10.000,00
      2. Contribuição previdenciária oficial 1.000,00
      5. Imposto sobre a Renda Retido na Fonte (IRRF) 500,00
      1. 13º (décimo terceiro) salário 8.000,00
      2. Imposto sobre a Renda Retido na Fonte sobre 13º (décimo terceiro) salário 1.200,00
    `;

    // 3. Process JSON
    const aggregated = aggregateWorkerData(mockWorkers, '2024');
    expect(aggregated).toHaveLength(1);
    const worker = aggregated[0];
    expect(worker.matricula).toBe('12345');
    expect(worker['Rendimentos Tributáveis']).toBe(10000);
    expect(worker['Previdência Oficial']).toBe(1000);

    // 4. Process PDF
    const informes = parseInformeText(pdfText);
    expect(informes).toHaveLength(1);
    const informe = informes[0];
    expect(informe.matricula).toBe('12345');
    expect(informe.totalRendimentos).toBe(10000);

    // 5. Simulate Matching (done in Home.tsx UI logic)
    const matchedWorker = {
      ...worker,
      pdfData: informe.matricula === worker.matricula ? {
        totalRendimentos: informe.totalRendimentos,
        previdenciaOficial: informe.previdenciaOficial,
        irrf: informe.irrf,
        decimoTerceiro: informe.decimoTerceiro,
        irrfDecimoTerceiro: informe.irrfDecimoTerceiro,
        plr: informe.plr,
        planoSaude: informe.planoSaude,
      } : undefined
    };

    expect(matchedWorker.pdfData).toBeDefined();
    expect(matchedWorker.pdfData?.totalRendimentos).toBe(worker['Rendimentos Tributáveis']);
    expect(matchedWorker.pdfData?.previdenciaOficial).toBe(worker['Previdência Oficial']);
  });
});
