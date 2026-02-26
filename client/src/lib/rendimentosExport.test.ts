import { describe, it, expect } from "vitest";
import {
  aggregateWorkerData,
  WorkerData,
  parseValue,
} from "./rendimentosExport";

describe("rendimentosExport", () => {
  describe("parseValue", () => {
    it("should parse Brazilian format numbers correctly", () => {
      expect(parseValue("1.234,56")).toBe(1234.56);
      expect(parseValue("R$ 1.234,56")).toBe(1234.56);
      expect(parseValue("1234,56")).toBe(1234.56);
      expect(parseValue("1234.56")).toBe(1234.56);
      expect(parseValue(100.5)).toBe(100.5);
      expect(parseValue("1.234.567,89")).toBe(1234567.89);
      expect(parseValue("1,00")).toBe(1);
    });
  });

  describe("aggregateWorkerData", () => {
    it("should correctly aggregate worker data and filter by year in the new structure", () => {
      const workers: WorkerData[] = [
        {
          matricula: "123",
          nome: "João Silva",
          cpf: "111.222.333-44",
          contracheques: [
            {
              ano: 2025,
              lancamentos: [
                { codigo: 8781, valor: "1.000,50" }, // Rendimentos Tributáveis
                { codigo: 9380, valor: 500.0 }, // Rendimentos Tributáveis
                { codigo: 999, valor: "200,00" }, // IRRF (Mensal/Férias)
                { codigo: 12, valor: "1.200,00" }, // 13º Salário (Exclusiva)
                { codigo: 8111, valor: "300,00" }, // Plano de Saúde
                { codigo: 8917, valor: "50,00" }, // Reembolso Plano de Saúde
                { codigo: 931, valor: "100,00" }, // Rendimentos Isentos
                { codigo: 873, valor: "1000,00" }, // PLR
                { codigo: 874, valor: "150,00" }, // IRRF PLR
              ],
            },
            {
              ano: 2024,
              lancamentos: [
                { codigo: 998, valor: "100,00" }, // Wrong year (Previdência)
              ],
            },
          ],
        },
      ];

      const aggregated = aggregateWorkerData(workers, "2025");

      expect(aggregated).toHaveLength(1);
      expect(aggregated[0]).toMatchObject({
        matricula: "123",
        nome: "João Silva",
        cpf: "111.222.333-44",
        "Rendimentos Tributáveis": 1600.5, // 1000.50 + 500 + 100 (931)
        "Previdência Oficial": 0, // Code 998 was in 2024
        "IRRF (Mensal/Férias)": 200.0,
        "13º Salário (Exclusiva)": 1200.0,
        "IRRF sobre 13º (Exclusiva)": 0,
        "PLR (Exclusiva)": 1000.0,
        "IRRF sobre PLR (Exclusiva)": 150.0,
        "Desconto Plano de Saúde": 250.0, // 300 - 50
        "Rendimentos Isentos": 0, // 931 is tributável in rules
        "Base Cálculo IRRF": 0, // No base calculation in this case
      });
    });

    it("should correctly sum baseCalculoIrrf from contracheques", () => {
      const workers: WorkerData[] = [
        {
          matricula: "123",
          nome: "João Silva",
          cpf: "111.222.333-44",
          contracheques: [
            {
              ano: 2025,
              baseCalculoIrrf: "3.726,19",
              lancamentos: [],
            },
            {
              ano: 2025,
              baseCalculoIrrf: 4000.0,
              lancamentos: [],
            },
            {
              ano: 2024,
              baseCalculoIrrf: 5000.0,
              lancamentos: [],
            },
          ],
        },
      ];

      const aggregated = aggregateWorkerData(workers, 2025);
      expect(aggregated).toHaveLength(1);
      // 3726.19 + 4000.00 = 7726.19
      expect(aggregated[0]["Base Cálculo IRRF"]).toBeCloseTo(7726.19, 2);
      expect(aggregated[0].details["Base Cálculo IRRF"]).toHaveLength(2);
    });

    it("should aggregate from multiple paychecks of the same year", () => {
      const workers: WorkerData[] = [
        {
          matricula: "456",
          nome: "Maria Souza",
          cpf: "555.666.777-88",
          contracheques: [
            {
              ano: 2025,
              lancamentos: [{ codigo: "8781", valor: 1000 }],
            },
            {
              ano: 2025,
              lancamentos: [{ codigo: "8781", valor: 1000 }],
            },
          ],
        },
      ];

      const aggregated = aggregateWorkerData(workers, 2025);
      expect(aggregated[0]["Rendimentos Tributáveis"]).toBe(2000);
    });

    // Note: The tests below for gozos are currently disabled because the logic is commented out in rendimentosExport.ts
    // to avoid unrequested changes in core calculations.
    /*
    it('should correctly include proventos from gozos filtered by payment year', () => {
      ...
    });
    */

    it("should deduct IRRF 13 (804, 827) and CP 13 (825) from 13º Salário (Exclusiva) in paychecks", () => {
      const workers: WorkerData[] = [
        {
          matricula: "303",
          nome: "Alice Santos",
          cpf: "111.111.111-11",
          contracheques: [
            {
              ano: 2025,
              lancamentos: [
                { codigo: "12", valor: 5000 }, // Gross 13th
                { codigo: "804", valor: 200 }, // IRRF 13
                { codigo: "825", valor: 150 }, // CP 13 code
              ],
            },
          ],
        },
      ];

      const aggregated = aggregateWorkerData(workers, 2025);
      // 5000 - 200 - 150 = 4650
      expect(aggregated[0]["13º Salário (Exclusiva)"]).toBe(4650);
      expect(aggregated[0]["IRRF sobre 13º (Exclusiva)"]).toBe(200);
      expect(aggregated[0]["CP 13º Salário"]).toBe(150);

      const details = aggregated[0].details["13º Salário (Exclusiva)"];
      expect(
        details.some(d => d.valor === -200 && d.descricao?.includes("Dedução"))
      ).toBe(true);
      expect(
        details.some(d => d.valor === -150 && d.descricao?.includes("Dedução"))
      ).toBe(true);
    });

    /*
    it('should deduct dependent values from 13º Salário during gozos processing', () => {
       ...
    });
    */

    it("should apply dependent deduction even if there are no gozos but there is 13th salary", () => {
      const workers: WorkerData[] = [
        {
          matricula: "606",
          nome: "Daniel Silva",
          cpf: "444.444.444-44",
          contracheques: [
            {
              ano: 2025,
              lancamentos: [{ codigo: "12", valor: 2000 }],
            },
          ],
          dependentes: [{ nome: "Filho", criterioFiscal: true }],
        },
      ];

      const aggregated = aggregateWorkerData(workers, 2025);
      // 2000 - 189.59 = 1810.41
      expect(aggregated[0]["13º Salário (Exclusiva)"]).toBeCloseTo(1810.41, 2);
      const details = aggregated[0].details["13º Salário (Exclusiva)"];
      expect(
        details.some(d => d.valor === -189.59 && d.origem === "Apuração Anual")
      ).toBe(true);
    });
  });
});
