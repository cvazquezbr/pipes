import { describe, it, expect } from 'vitest';
import { compareWorkers } from './workerComparison';
import { WorkerData } from './rendimentosExport';

describe('workerComparison', () => {
  const baseWorker: WorkerData = {
    matricula: '12345',
    nome: 'JOAO GABRIEL TAVARES',
    cpf: '123.456.789-00',
    contracheques: [
      {
        ano: 2025,
        nomeFolha: 'MENSAL',
        dataPagamento: '2025-01-05',
        lancamentos: [{ codigo: 1, descricao: 'SALARIO', valor: 5000 }],
        totalProventos: 5000,
        totalDescontos: 0,
        valorLiquido: 5000,
        baseInss: 5000,
        baseIrrf: 5000,
        inss: 0,
        irrf: 0
      }
    ],
    dependentes: [
      { nome: 'FILHO 1', criterioFiscal: true }
    ],
    periodosAquisitivos: []
  };

  it('detects an added worker', () => {
    const oldData: WorkerData[] = [];
    const newData: WorkerData[] = [baseWorker];
    const result = compareWorkers(oldData, newData);
    expect(result.added).toBe(1);
    expect(result.changes[0].matricula).toBe('12345');
    expect(result.changes[0].type).toBe('added');
  });

  it('detects a removed worker', () => {
    const oldData: WorkerData[] = [baseWorker];
    const newData: WorkerData[] = [];
    const result = compareWorkers(oldData, newData);
    expect(result.removed).toBe(1);
    expect(result.changes[0].matricula).toBe('12345');
    expect(result.changes[0].type).toBe('removed');
  });

  it('detects a modification in simple fields', () => {
    const oldData: WorkerData[] = [baseWorker];
    const newData: WorkerData[] = [{ ...baseWorker, nome: 'JOAO G. TAVARES' }];
    const result = compareWorkers(oldData, newData);
    expect(result.modified).toBe(1);
    expect(result.changes[0].fieldChanges).toContainEqual({
      field: 'nome',
      label: 'Nome Completo do Colaborador',
      oldValue: 'JOAO GABRIEL TAVARES',
      newValue: 'JOAO G. TAVARES'
    });
  });

  it('detects a modification in dependentes', () => {
    const oldData: WorkerData[] = [baseWorker];
    const newData: WorkerData[] = {
      ...baseWorker,
      dependentes: [
        { nome: 'FILHO 1', criterioFiscal: false },
        { nome: 'FILHO 2', criterioFiscal: true }
      ]
    } as any;
    const result = compareWorkers(oldData, [newData as WorkerData]);
    expect(result.modified).toBe(1);
    const changes = result.changes[0].fieldChanges!;
    expect(changes.some(c => c.label === 'Dependente: FILHO 1' && c.newValue === 'Criterio Fiscal: Não')).toBe(true);
    expect(changes.some(c => c.label === 'Novo Dependente' && c.newValue === 'FILHO 2 (Fiscal: Sim)')).toBe(true);
  });

  it('detects a modification in contracheques values', () => {
    const oldData: WorkerData[] = [baseWorker];
    const modifiedWorker = JSON.parse(JSON.stringify(baseWorker));
    modifiedWorker.contracheques[0].lancamentos[0].valor = 5500;

    const result = compareWorkers(oldData, [modifiedWorker]);
    expect(result.modified).toBe(1);
    expect(result.changes[0].fieldChanges!.some(c => c.label.includes('Alteração no Contracheque'))).toBe(true);
  });

  it('ignores differences in CPF formatting', () => {
    const oldData: WorkerData[] = [{ ...baseWorker, cpf: '123.456.789-00' }];
    const newData: WorkerData[] = [{ ...baseWorker, cpf: '12345678900' }];
    const result = compareWorkers(oldData, newData);
    expect(result.modified).toBe(0);
  });

  it('ignores differences in Name casing or whitespace', () => {
    const oldData: WorkerData[] = [{ ...baseWorker, nome: 'JOAO GABRIEL TAVARES' }];
    const newData: WorkerData[] = [{ ...baseWorker, nome: ' joao gabriel tavares ' }];
    const result = compareWorkers(oldData, newData);
    expect(result.modified).toBe(0);
  });
});
