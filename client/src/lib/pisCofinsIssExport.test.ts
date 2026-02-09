import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processPisCofinsIssData } from './pisCofinsIssExport';

describe('pisCofinsIssExport', () => {
  beforeEach(() => {
    // Mock date to 2024-01-15
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should calculate taxes correctly for a simple invoice', () => {
    // Target period D will be 2023-12 because 2024-01-15 - 20 days = 2023-12-26

    const invoiceData = [
      {
        'Invoice Number': '1001',
        'Invoice Date': '2023-12-15',
        'Invoice Status': 'Paid',
        'Customer Name': 'Cliente Teste',
        'Total': 1000,
        'Item Tax': 'Standard',
        'Item Tax Amount': 50
      }
    ];

    const taxMappings = [
      {
        'Item Tax': 'Standard',
        'IRPJ': 0.01,
        'CSLL': 0.01,
        'COFINS': 0.01,
        'PIS': 0.01,
        'ISS': 0.01
      }
    ];

    const allSheets = {
      'Impostos': taxMappings
    };

    const result = processPisCofinsIssData(invoiceData, [], allSheets);
    const fatura = result.faturasFinais[0];

    expect(fatura).toBeDefined();
    // IRPJ.devido = 1000 * 0.048 = 48
    // IRPJ.retido = 1000 * 0.01 = 10
    // IRPJ.pendente = 38
    expect(fatura['IRPJ.devido']).toBe(48);
    expect(fatura['IRPJ.retido']).toBe(10);
    expect(fatura['IRPJ.pendente']).toBe(38);

    // COFINS.devido = 1000 * 0.03 = 30
    // COFINS.retido = 1000 * 0.01 = 10
    // COFINS.pendente = 20
    expect(fatura['COFINS.devido']).toBe(30);
    expect(fatura['COFINS.retido']).toBe(10);
    expect(fatura['COFINS.pendente']).toBe(20);
  });

  it('should handle Itaipu Binacional special case', () => {
    const invoiceData = [
      {
        'Invoice Number': '2001',
        'Invoice Date': '2023-12-15',
        'Invoice Status': 'Paid',
        'Customer Name': 'Itaipu Binacional',
        'Total': 1000,
        'Item Tax': '11 | IR 1,5% + CSLL',
        'Item Tax Amount': 0
      }
    ];

    const result = processPisCofinsIssData(invoiceData, [], null);
    const fatura = result.faturasFinais[0];

    // Special case: COFINS.devido = 0, PIS.devido = 0, ISS.devido = 0
    expect(fatura['COFINS.devido']).toBe(0);
    expect(fatura['PIS.devido']).toBe(0);
    expect(fatura['ISS.devido']).toBe(0);
    // IRPJ still applies: 1000 * 0.048 = 48
    expect(fatura['IRPJ.devido']).toBe(48);
  });

  it('should calculate ISS antecipado with proportional split', () => {
    const invoiceData = [
      {
        'Invoice Number': '3001',
        'Invoice Date': '2023-12-01',
        'Invoice Status': 'Paid',
        'Total': 100, // 1/3 of total
        'Customer Name': 'C1'
      },
      {
        'Invoice Number': '3002',
        'Invoice Date': '2023-12-01',
        'Invoice Status': 'Paid',
        'Total': 200, // 2/3 of total
        'Customer Name': 'C2'
      }
    ];

    const billData = [
      {
        'Bill Number': 'ISS 3001, 3002',
        'Bill Date': '2023-12-10',
        'Rate': 30
      }
    ];

    const result = processPisCofinsIssData(invoiceData, billData, null);

    const f1 = result.faturasFinais.find(f => f.InvoiceNumber === '3001');
    const f2 = result.faturasFinais.find(f => f.InvoiceNumber === '3002');

    expect(f1?.['ISS.antecipado']).toBe(10); // 100/300 * 30
    expect(f2?.['ISS.antecipado']).toBe(20); // 200/300 * 30
  });

  it('should filter out invoices from different periods', () => {
     const invoiceData = [
      {
        'Invoice Number': '1',
        'Invoice Date': '2023-12-15', // Target period
        'Invoice Status': 'Paid'
      },
      {
        'Invoice Number': '2',
        'Invoice Date': '2024-01-15', // Wrong period
        'Invoice Status': 'Paid'
      }
    ];

    const result = processPisCofinsIssData(invoiceData, [], null);
    expect(result.faturasFinais.length).toBe(1);
    expect(result.faturasFinais[0].InvoiceNumber).toBe('1');
  });
});
