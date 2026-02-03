import { describe, it, expect } from 'vitest';
import { convertToZOHO, extractAllocationData } from './zohoExport';
import type { ExtractedInvoice } from './types';

describe('zohoExport account determination', () => {
  const baseInvoice: ExtractedInvoice = {
    nfsNumber: '123',
    accessKey: 'key',
    seriesNumber: '1',
    emissionDate: '2023-01-01',
    emissionTime: '10:00',
    issuerName: 'Issuer',
    issuerCNPJ: '00.000.000/0000-00',
    issuerAddress: '',
    issuerCity: '',
    issuerState: '',
    issuerCEP: '',
    takerName: 'Taker',
    takerCNPJ: '11.111.111/0001-11',
    takerAddress: '',
    takerCity: '',
    takerState: '',
    takerCEP: '',
    serviceCode: '1.01',
    serviceDescription: 'Standard Service',
    serviceValue: 10000, // R$ 100,00
    deductions: 0,
    irrf: 0,
    pis: 0,
    cofins: 0,
    csll: 0,
    issqnBase: 10000,
    issqnApurado: 500,
    issqnAliquota: '5%',
    issqnSuspensao: 'Não',
    issqnMunicipio: 'City',
    issqnTributacao: 'Normal',
    issqnRetido: 0,
    totalTaxes: 0,
    netValue: 10000,
    filename: 'test.pdf',
    extractionConfidence: 1,
  };

  const testCases = [
    { desc: 'Serviço VGPF-001', expected: 'VGPF-EAD' },
    { desc: 'CAPF EAD Training', expected: 'CAPF EAD' },
    { desc: 'PCOSMIC-EAD Implementation', expected: 'COSMIC-EAD' },
    { desc: 'CFPS Module', expected: 'PCFPS-EAD' },
    { desc: 'SNAP license', expected: 'SNAP-EAD' },
    { desc: 'EREQ support', expected: 'EREQ EAD' },
    { desc: 'ETSW consulting', expected: 'ESTIMATIVAS EAD' },
    { desc: 'Generic Service', expected: 'Vendas' },
  ];

  testCases.forEach(({ desc, expected }) => {
    it(`should map "${desc}" to account "${expected}"`, () => {
      const invoice = { ...baseInvoice, serviceDescription: desc };
      const result = convertToZOHO(invoice);
      expect(result.Account).toBe(expected);
    });
  });

  it('should override client mapping account with description-based account', () => {
    const invoice = { ...baseInvoice, serviceDescription: 'VGPF Service' };
    const clientMappings = [
      { de: 'TAKER', para: 'Normalized Taker', account: 'Client Account' }
    ];
    const result = convertToZOHO(invoice, [], clientMappings);
    expect(result.Account).toBe('VGPF-EAD');
  });

  it('should use client mapping account if no keyword matches', () => {
    const invoice = { ...baseInvoice, serviceDescription: 'Generic Service' };
    const clientMappings = [
      { de: 'TAKER', para: 'Normalized Taker', account: 'Client Account' }
    ];
    const result = convertToZOHO(invoice, [], clientMappings);
    expect(result.Account).toBe('Client Account');
  });
});

describe('zohoExport new requirements', () => {
  const baseInvoice: ExtractedInvoice = {
    nfsNumber: '123',
    accessKey: 'key',
    seriesNumber: '1',
    emissionDate: '10/05/2024',
    emissionTime: '10:00',
    issuerName: 'Issuer',
    issuerCNPJ: '00.000.000/0000-00',
    issuerAddress: '',
    issuerCity: '',
    issuerState: '',
    issuerCEP: '',
    takerName: 'Taker',
    takerCNPJ: '11.111.111/0001-11',
    takerAddress: '',
    takerCity: '',
    takerState: '',
    takerCEP: '',
    serviceCode: '1.01',
    serviceDescription: 'Standard Service',
    serviceValue: 10000, // R$ 100,00
    deductions: 0,
    irrf: 0,
    pis: 0,
    cofins: 0,
    csll: 0,
    issqnBase: 10000,
    issqnApurado: 500,
    issqnAliquota: '5%',
    issqnSuspensao: 'Não',
    issqnMunicipio: 'City',
    issqnTributacao: 'Normal',
    issqnRetido: 0,
    totalTaxes: 0,
    netValue: 10000,
    filename: 'test.pdf',
    extractionConfidence: 1,
    isCancelled: false,
  };

  it('should format Invoice Date to YYYY-MM-DD', () => {
    const result = convertToZOHO(baseInvoice);
    expect(result['Invoice Date']).toBe('2024-05-10');
  });

  it('should calculate Due Date correctly with days', () => {
    const allocationData = [
      { cliente: 'TAKER', equipe: 'E1', projeto: 'P1', dueDateDays: 15 }
    ];
    const clientMappings = [
      { de: 'TAKER', para: 'TAKER', account: 'Vendas' }
    ];
    const result = convertToZOHO(baseInvoice, [], clientMappings, allocationData);
    expect(result['Due Date']).toBe('2024-05-25');
  });

  it('should calculate Due Date as empty if days is undefined (missing column)', () => {
    const result = convertToZOHO(baseInvoice);
    expect(result['Due Date']).toBe('');
  });

  it('should calculate Due Date as Invoice Date if days is 0', () => {
    const allocationData = [
      { cliente: 'TAKER', equipe: 'E1', projeto: 'P1', dueDateDays: 0 }
    ];
    const clientMappings = [
      { de: 'TAKER', para: 'TAKER', account: 'Vendas' }
    ];
    const result = convertToZOHO(baseInvoice, [], clientMappings, allocationData);
    expect(result['Due Date']).toBe('2024-05-10');
  });

  it('should set Invoice Status to Void if cancelled', () => {
    const cancelledInvoice = { ...baseInvoice, isCancelled: true };
    const result = convertToZOHO(cancelledInvoice);
    expect(result['Invoice Status']).toBe('Void');
  });

  it('should extract dueDateDays from the 4th column (keys[3])', () => {
    const rawData = [
      { 'Col1': 'Cliente A', 'Col2': 'Equipe A', 'Col3': 'Projeto A', 'Col4': 30 }
    ];
    const extracted = extractAllocationData(rawData);
    expect(extracted[0].dueDateDays).toBe(30);
  });

  it('should set dueDateDays as undefined if 4th column is missing', () => {
    const rawData = [
      { 'Col1': 'Cliente A', 'Col2': 'Equipe A', 'Col3': 'Projeto A' }
    ];
    const extracted = extractAllocationData(rawData);
    expect(extracted[0].dueDateDays).toBeUndefined();
  });

  it('should set dueDateDays as undefined if 4th column is null', () => {
    const rawData = [
      { 'Col1': 'Cliente A', 'Col2': 'Equipe A', 'Col3': 'Projeto A', 'Col4': null }
    ];
    const extracted = extractAllocationData(rawData);
    expect(extracted[0].dueDateDays).toBeUndefined();
  });

  it('should set dueDateDays as undefined if 4th column is an empty string', () => {
    const rawData = [
      { 'Col1': 'Cliente A', 'Col2': 'Equipe A', 'Col3': 'Projeto A', 'Col4': '' }
    ];
    const extracted = extractAllocationData(rawData);
    expect(extracted[0].dueDateDays).toBeUndefined();
  });
});
