import { describe, it, expect } from "vitest";
import { processIrpjCsllData } from "./irpjCsllExport";

describe("irpjCsllExport", () => {
  const mockTaxMappings = [
    {
      "Item Tax": "Standard",
      IRPJ: "1,5%",
      CSLL: "1%",
    },
  ];

  const mockAllSheets = {
    Impostos: mockTaxMappings,
  };

  const mockInvoices = [
    {
      "Invoice Number": "1001",
      "Invoice Date": "2023-12-01",
      "Customer Name": "Cliente A",
      Total: "10000,00",
      "Item Tax": "Standard",
      "Item Tax Amount": "150,00",
      "Invoice Status": "Sent",
    },
  ];

  it("should calculate IRPJ and CSLL correctly", () => {
    const result = processIrpjCsllData(mockInvoices, mockAllSheets, 5000, 1000);
    const { resumo, faturasFinais } = result;

    // Total Faturado = 10000
    expect(resumo.totalFaturado).toBe(10000);

    // Presunção de Lucro = 10000 * 0.32 = 3200
    expect(resumo.presuncaoIRPJ).toBe(3200);
    expect(resumo.presuncaoCSLL).toBe(3200);

    // Base de Cálculo = 3200 + 5000 = 8200
    expect(resumo.baseCalculoIRPJ).toBe(8200);
    expect(resumo.baseCalculoCSLL).toBe(8200);

    // IR Devido = 8200 * 0.15 = 1230
    expect(resumo.irDevido).toBe(1230);

    // IR Adicional = max(0, 8200 - 60000) * 0.1 = 0
    expect(resumo.irAdicional).toBe(0);

    // IRPJ Retido NF = 10000 * 0.015 = 150
    // IR Retido Total = 150 + 1000 = 1150
    expect(resumo.irRetidoTotal).toBe(1150);

    // Total IRPJ Devido = 1230 + 0 - 1150 = 80
    expect(resumo.totalIrpjDevido).toBe(80);

    // CSLL Devido Total = 8200 * 0.09 = 738
    expect(resumo.csllDevidoTotal).toBe(738);

    // CSLL Retido NF = 10000 * 0.01 = 100
    expect(resumo.csllRetidoTotal).toBe(100);

    // Total CSLL Devido = 738 - 100 = 638
    expect(resumo.totalCsllDevido).toBe(638);

    // Faturas
    expect(faturasFinais[0]["contribuicao.IRPJ"]).toBe(80);
    expect(faturasFinais[0]["contribuicao.CSLL"]).toBe(638);
  });

  it("should NOT calculate IR Adicional when all invoices are from 2025 or before", () => {
    const invoices2025 = [{ ...mockInvoices[0], "Invoice Date": "2025-12-31" }];
    const result = processIrpjCsllData(invoices2025, mockAllSheets, 100000, 0);
    const { resumo } = result;

    // Base de Cálculo = 3200 + 100000 = 103200
    // Even though base is > 60000, year is 2025, so IR Adicional should be 0
    expect(resumo.irAdicional).toBe(0);
  });

  it("should calculate IR Adicional when there is an invoice after 2025 and base is above 60000", () => {
    const invoices2026 = [{ ...mockInvoices[0], "Invoice Date": "2026-01-01" }];
    const result = processIrpjCsllData(invoices2026, mockAllSheets, 100000, 0);
    const { resumo } = result;

    // Base de Cálculo = 3200 + 100000 = 103200
    // IR Adicional = (103200 - 60000) * 0.1 = 43200 * 0.1 = 4320
    expect(resumo.irAdicional).toBe(4320);
  });

  describe("LC 224/2025 (Year 2026 Rules)", () => {
    it("should apply exceeding rule for IRPJ but NOT CSLL in 2026 Q1", () => {
      const invoices2026Q1 = [
        {
          ...mockInvoices[0],
          "Invoice Date": "2026-01-15",
          Total: "2000000,00",
        },
      ];
      const result = processIrpjCsllData(invoices2026Q1, mockAllSheets, 0, 0);
      const { resumo } = result;

      // totalFaturado = 2.000.000
      // LIMITE_FAIXA = 1.250.000
      // PRESUNCAO_LUCRO = 0.32
      // ALIQUOTA_EXCEDENTE = 0.352

      // IRPJ Presunção = (1.250.000 * 0.32) + (750.000 * 0.352)
      // = 400.000 + 264.000 = 664.000
      expect(resumo.presuncaoIRPJ).toBe(664000);

      // CSLL Presunção (linear) = 2.000.000 * 0.32 = 640.000
      expect(resumo.presuncaoCSLL).toBe(640000);
    });

    it("should apply exceeding rule for BOTH IRPJ and CSLL in 2026 Q2", () => {
      const invoices2026Q2 = [
        {
          ...mockInvoices[0],
          "Invoice Date": "2026-04-10",
          Total: "2000000,00",
        },
      ];
      const result = processIrpjCsllData(invoices2026Q2, mockAllSheets, 0, 0);
      const { resumo } = result;

      // Both should use the exceeding rule
      // Presunção = (1.250.000 * 0.32) + (750.000 * 0.352) = 664.000
      expect(resumo.presuncaoIRPJ).toBe(664000);
      expect(resumo.presuncaoCSLL).toBe(664000);
    });

    it("should NOT apply exceeding rule before 2026", () => {
      const invoices2025 = [
        {
          ...mockInvoices[0],
          "Invoice Date": "2025-12-31",
          Total: "2000000,00",
        },
      ];
      const result = processIrpjCsllData(invoices2025, mockAllSheets, 0, 0);
      const { resumo } = result;

      // Linear calculation for both
      // 2.000.000 * 0.32 = 640.000
      expect(resumo.presuncaoIRPJ).toBe(640000);
      expect(resumo.presuncaoCSLL).toBe(640000);
    });
  });

  describe("Validation", () => {
    it("should set validationError when invoices belong to different quarters", () => {
      const mixedInvoices = [
        { ...mockInvoices[0], "Invoice Date": "2026-01-15" },
        { ...mockInvoices[0], "Invoice Date": "2026-04-10", "Invoice Number": "1002" },
      ];
      const result = processIrpjCsllData(mixedInvoices, mockAllSheets, 0, 0);
      expect(result.resumo.validationError).toContain("trimestres diferentes");
    });
  });
});
