import { describe, it, expect } from "vitest";
import {
  convertToZOHO,
  extractAllocationData,
  generateZOHOValidationReport,
  extractTaxMappings,
} from "./zohoExport";
import type { ExtractedInvoice } from "./types";

describe("zohoExport account determination", () => {
  const baseInvoice: ExtractedInvoice = {
    nfsNumber: "123",
    accessKey: "key",
    seriesNumber: "1",
    emissionDate: "2023-01-01",
    emissionTime: "10:00",
    issuerName: "Issuer",
    issuerCNPJ: "00.000.000/0000-00",
    issuerAddress: "",
    issuerCity: "",
    issuerState: "",
    issuerCEP: "",
    takerName: "Taker",
    takerCNPJ: "11.111.111/0001-11",
    takerAddress: "",
    takerCity: "",
    takerState: "",
    takerCEP: "",
    serviceCode: "1.01",
    serviceDescription: "Standard Service",
    serviceValue: 10000, // R$ 100,00
    deductions: 0,
    irrf: 0,
    pis: 0,
    pisRetido: 0,
    pisPendente: 0,
    cofins: 0,
    cofinsRetido: 0,
    cofinsPendente: 0,
    csll: 0,
    issqnBase: 10000,
    issqnApurado: 500,
    issqnAliquota: "5%",
    issqnSuspensao: "Não",
    issqnMunicipio: "City",
    issqnTributacao: "Normal",
    issqnRetido: 0,
    totalTaxes: 0,
    netValue: 10000,
    filename: "test.pdf",
    extractionConfidence: 1,
  };

  const testCases = [
    { desc: "Serviço VGPF-001", expected: "VGPF-EAD" },
    { desc: "CAPF EAD Training", expected: "CAPF EAD" },
    { desc: "PCOSMIC-EAD Implementation", expected: "COSMIC-EAD" },
    { desc: "CFPS Module", expected: "PCFPS-EAD" },
    { desc: "SNAP license", expected: "SNAP-EAD" },
    { desc: "EREQ support", expected: "EREQ EAD" },
    { desc: "ETSW consulting", expected: "ESTIMATIVAS EAD" },
    { desc: "Generic Service", expected: "Vendas" },
  ];

  testCases.forEach(({ desc, expected }) => {
    it(`should map "${desc}" to account "${expected}"`, () => {
      const invoice = { ...baseInvoice, serviceDescription: desc };
      const result = convertToZOHO(invoice);
      expect(result.Account).toBe(expected);
    });
  });

  it("should override client mapping account with description-based account", () => {
    const invoice = { ...baseInvoice, serviceDescription: "VGPF Service" };
    const clientMappings = [
      { de: "TAKER", para: "Normalized Taker", account: "Client Account" },
    ];
    const result = convertToZOHO(invoice, [], clientMappings);
    expect(result.Account).toBe("VGPF-EAD");
  });

  it("should use client mapping account if no keyword matches", () => {
    const invoice = { ...baseInvoice, serviceDescription: "Generic Service" };
    const clientMappings = [
      { de: "TAKER", para: "Normalized Taker", account: "Client Account" },
    ];
    const result = convertToZOHO(invoice, [], clientMappings);
    expect(result.Account).toBe("Client Account");
  });
});

describe("zohoExport new requirements", () => {
  const baseInvoice: ExtractedInvoice = {
    nfsNumber: "123",
    accessKey: "key",
    seriesNumber: "1",
    emissionDate: "10/05/2024",
    emissionTime: "10:00",
    issuerName: "Issuer",
    issuerCNPJ: "00.000.000/0000-00",
    issuerAddress: "",
    issuerCity: "",
    issuerState: "",
    issuerCEP: "",
    takerName: "Taker",
    takerCNPJ: "11.111.111/0001-11",
    takerAddress: "",
    takerCity: "",
    takerState: "",
    takerCEP: "",
    serviceCode: "1.01",
    serviceDescription: "Standard Service",
    serviceValue: 10000, // R$ 100,00
    deductions: 0,
    irrf: 0,
    pis: 0,
    pisRetido: 0,
    pisPendente: 0,
    cofins: 0,
    cofinsRetido: 0,
    cofinsPendente: 0,
    csll: 0,
    issqnBase: 10000,
    issqnApurado: 500,
    issqnAliquota: "5%",
    issqnSuspensao: "Não",
    issqnMunicipio: "City",
    issqnTributacao: "Normal",
    issqnRetido: 0,
    totalTaxes: 0,
    netValue: 10000,
    filename: "test.pdf",
    extractionConfidence: 1,
    isCancelled: false,
  };

  it("should format Invoice Date to YYYY-MM-DD", () => {
    const result = convertToZOHO(baseInvoice);
    expect(result["Invoice Date"]).toBe("2024-05-10");
  });

  it("should calculate Due Date correctly with days", () => {
    const allocationData = [
      { cliente: "TAKER", equipe: "E1", projeto: "P1", dueDateDays: 15 },
    ];
    const clientMappings = [{ de: "TAKER", para: "TAKER", account: "Vendas" }];
    const result = convertToZOHO(
      baseInvoice,
      [],
      clientMappings,
      allocationData
    );
    expect(result["Due Date"]).toBe("2024-05-25");
  });

  it("should fill Project Name from allocation data", () => {
    const allocationData = [
      { cliente: "TAKER", equipe: "E1", projeto: "PROJECT_X", dueDateDays: 15 },
    ];
    const clientMappings = [{ de: "TAKER", para: "TAKER", account: "Vendas" }];
    const result = convertToZOHO(
      baseInvoice,
      [],
      clientMappings,
      allocationData
    );
    expect(result["Project Name"]).toBe("PROJECT_X");
  });

  it("should calculate Due Date as empty if days is undefined (missing column)", () => {
    const result = convertToZOHO(baseInvoice);
    expect(result["Due Date"]).toBe("");
  });

  it("should calculate Due Date as Invoice Date if days is 0", () => {
    const allocationData = [
      { cliente: "TAKER", equipe: "E1", projeto: "P1", dueDateDays: 0 },
    ];
    const clientMappings = [{ de: "TAKER", para: "TAKER", account: "Vendas" }];
    const result = convertToZOHO(
      baseInvoice,
      [],
      clientMappings,
      allocationData
    );
    expect(result["Due Date"]).toBe("2024-05-10");
  });

  it("should format Invoice Number with leading zeros (6 digits)", () => {
    const result = convertToZOHO({ ...baseInvoice, nfsNumber: "123" });
    expect(result["Invoice Number"]).toBe("000123");
  });

  it("should not truncate Invoice Number if it has more than 6 digits", () => {
    const result = convertToZOHO({ ...baseInvoice, nfsNumber: "1234567" });
    expect(result["Invoice Number"]).toBe("1234567");
  });

  it("should format Item Tax1 % without the % symbol", () => {
    const taxMappings = [
      {
        percentual: 5,
        itemTax1: "ISS",
        itemTax1Type: "Tax",
        isInclusiveTax: "false",
        itemTax1Percent: "5.00",
        irpj: 0,
        csll: 0,
        cofins: 0,
        pis: 0,
        iss: 5,
        outros: 0,
      },
    ];
    // Create an invoice that matches the 5% retention
    const invoice = {
      ...baseInvoice,
      serviceValue: 10000,
      netValue: 9500, // 5% retention
    };
    const result = convertToZOHO(invoice, taxMappings);
    expect(result["Item Tax1 %"]).toBe("5.00");
    expect(result["Item Tax1 %"]).not.toContain("%");
  });

  it("should set Invoice Status to Void if cancelled", () => {
    const cancelledInvoice = { ...baseInvoice, isCancelled: true };
    const result = convertToZOHO(cancelledInvoice);
    expect(result["Invoice Status"]).toBe("Void");
  });

  it("should extract dueDateDays from the 4th column (keys[3])", () => {
    const rawData = [
      { Col1: "Cliente A", Col2: "Equipe A", Col3: "Projeto A", Col4: 30 },
    ];
    const extracted = extractAllocationData(rawData);
    expect(extracted[0].dueDateDays).toBe(30);
  });

  it('should extract dueDateDays from "Vencimento" header', () => {
    const rawData = [
      {
        Cliente: "Cliente A",
        Equipe: "Equipe A",
        Projeto: "Projeto A",
        Vencimento: 45,
      },
    ];
    const extracted = extractAllocationData(rawData);
    expect(extracted[0].dueDateDays).toBe(45);
  });

  it('should extract Projeto from "Projeto" header', () => {
    const rawData = [
      { Cliente: "C1", Equipe: "E1", Projeto: "P1", Vencimento: 30 },
    ];
    const extracted = extractAllocationData(rawData);
    expect(extracted[0].projeto).toBe("P1");
  });

  it("should extract Projeto from 3rd column if header is missing", () => {
    const rawData = [
      { C1: "Cliente A", C2: "Equipe A", C3: "Projeto A", C4: 30 },
    ];
    const extracted = extractAllocationData(rawData);
    expect(extracted[0].projeto).toBe("Projeto A");
  });

  it("should set dueDateDays as undefined if 4th column is missing", () => {
    const rawData = [
      { Col1: "Cliente A", Col2: "Equipe A", Col3: "Projeto A" },
    ];
    const extracted = extractAllocationData(rawData);
    expect(extracted[0].dueDateDays).toBeUndefined();
  });

  it("should set dueDateDays as undefined if 4th column is null", () => {
    const rawData = [
      { Col1: "Cliente A", Col2: "Equipe A", Col3: "Projeto A", Col4: null },
    ];
    const extracted = extractAllocationData(rawData);
    expect(extracted[0].dueDateDays).toBeUndefined();
  });

  it("should set dueDateDays as undefined if 4th column is an empty string", () => {
    const rawData = [
      { Col1: "Cliente A", Col2: "Equipe A", Col3: "Projeto A", Col4: "" },
    ];
    const extracted = extractAllocationData(rawData);
    expect(extracted[0].dueDateDays).toBeUndefined();
  });
});

describe("zohoExport tax extraction", () => {
  it("should remove % from Item Tax1 % during extraction", () => {
    const rawData = [{ "Item Tax1": "ISS", "Item Tax1 %": "5.00%" }];
    const extracted = extractTaxMappings(rawData);
    expect(extracted[0].itemTax1Percent).toBe("5.00");
  });

  it("should add .00 if % is removed from a whole number", () => {
    const rawData = [{ "Item Tax1": "ISS", "Item Tax1 %": "5%" }];
    const extracted = extractTaxMappings(rawData);
    expect(extracted[0].itemTax1Percent).toBe("5.00");
  });
});

describe("zohoExport filtering logic", () => {
  const baseInvoice: ExtractedInvoice = {
    nfsNumber: "100",
    accessKey: "key",
    seriesNumber: "1",
    emissionDate: "10/05/2024",
    emissionTime: "10:00",
    issuerName: "Issuer",
    issuerCNPJ: "00.000.000/0000-00",
    issuerAddress: "",
    issuerCity: "",
    issuerState: "",
    issuerCEP: "",
    takerName: "Taker",
    takerCNPJ: "11.111.111/0001-11",
    takerAddress: "",
    takerCity: "",
    takerState: "",
    takerCEP: "",
    serviceCode: "1.01",
    serviceDescription: "Standard Service",
    serviceValue: 10000,
    deductions: 0,
    irrf: 0,
    pis: 0,
    pisRetido: 0,
    pisPendente: 0,
    cofins: 0,
    cofinsRetido: 0,
    cofinsPendente: 0,
    csll: 0,
    issqnBase: 10000,
    issqnApurado: 500,
    issqnAliquota: "5%",
    issqnSuspensao: "Não",
    issqnMunicipio: "City",
    issqnTributacao: "Normal",
    issqnRetido: 0,
    totalTaxes: 0,
    netValue: 10000,
    filename: "test.pdf",
    extractionConfidence: 1,
    isCancelled: false,
  };

  it("should include cancelled invoice even if it is unique", () => {
    const invoices = [{ ...baseInvoice, nfsNumber: "101", isCancelled: true }];
    const report = generateZOHOValidationReport(invoices);
    expect(report.totalInvoices).toBe(1);
    expect(report.validInvoices).toBe(1);
  });

  it("should include ONLY the cancelled invoice if there is another (active) invoice with the same number", () => {
    const invoices = [
      {
        ...baseInvoice,
        nfsNumber: "102",
        isCancelled: false,
        filename: "active.pdf",
      },
      {
        ...baseInvoice,
        nfsNumber: "102",
        isCancelled: true,
        filename: "cancelled.pdf",
      },
    ];
    const report = generateZOHOValidationReport(invoices);
    // Should keep only the cancelled one
    expect(report.totalInvoices).toBe(1);
    expect(report.validInvoices).toBe(1);
  });

  it("should include all non-cancelled invoices with nfsNumber", () => {
    const invoices = [
      { ...baseInvoice, nfsNumber: "103", isCancelled: false },
      { ...baseInvoice, nfsNumber: "104", isCancelled: false },
    ];
    const report = generateZOHOValidationReport(invoices);
    expect(report.totalInvoices).toBe(2);
  });

  it("should include invoices without nfsNumber in total but flag them as issues", () => {
    const invoices = [
      { ...baseInvoice, nfsNumber: "", isCancelled: false },
      { ...baseInvoice, nfsNumber: "105", isCancelled: false },
    ];
    const report = generateZOHOValidationReport(invoices);
    // Should be 2 because we want to report the issue for the one without number
    expect(report.totalInvoices).toBe(2);
    expect(report.invalidInvoices).toBe(1);
    expect(report.issues[0].issue).toBe("Número NFS-e não extraído");
  });
});
