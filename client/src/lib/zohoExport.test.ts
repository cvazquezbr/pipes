import { describe, it, expect } from 'vitest';
import { convertToZOHO } from './zohoExport';
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
    issqnCP: 0,
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
