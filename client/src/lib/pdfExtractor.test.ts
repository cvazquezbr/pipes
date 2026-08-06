import { describe, it, expect } from "vitest";
import { EXTRACTION_PATTERNS_V1, EXTRACTION_PATTERNS_V2, getExtractionPatterns } from "./extractionPatterns";
import { NFE_327_V1_TEXT, NFE_330_V2_TEXT } from "./test-fixtures-text";

// Simple local mock of text normalization to simulate exact extractor inputs
function normalizeText(text: string): string {
  let normalized = text
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200C\u200D\u200E\u200F]/g, "")
    .replace(/[\u061C\u180E]/g, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

function extractValue(
  text: string,
  pattern: RegExp,
  processor?: (value: string) => string | number
): string | number | null {
  const match = text.match(pattern);
  if (!match || !match[1]) {
    return null;
  }

  const value = match[1].trim();
  return processor ? processor(value) : value;
}

function parseMonetaryValue(value: string): number {
  const cleaned = value.replace(/R\$\s*/g, "").trim();
  if (cleaned === "-" || cleaned === "") return 0;

  const parts = cleaned.split(",");

  if (parts.length === 1) {
    const val = parseFloat(parts[0]);
    return isNaN(val) ? 0 : Math.round(val * 100);
  }

  const reais = parts[0].replace(/\./g, "");
  const centavos = parts[1].padEnd(2, "0").substring(0, 2);
  return parseInt(reais + centavos, 10) || 0;
}

describe("pdfExtractor layout detection and patterns", () => {
  const normV1Text = normalizeText(NFE_327_V1_TEXT);
  const normV2Text = normalizeText(NFE_330_V2_TEXT);

  describe("Version Detection", () => {
    it("should correctly detect v1 version", () => {
      const danfseVersion = /DANFSe v2/i.test(normV1Text) ? "v2" : "v1";
      expect(danfseVersion).toBe("v1");
    });

    it("should correctly detect v2 version", () => {
      const danfseVersion = /DANFSe v2/i.test(normV2Text) ? "v2" : "v1";
      expect(danfseVersion).toBe("v2");
    });
  });

  describe("NFe 327 (v1.0) Pattern Matches", () => {
    const p = EXTRACTION_PATTERNS_V1;

    it("should extract correct NFS Number", () => {
      expect(extractValue(normV1Text, p.nfsNumber)).toBe("327");
    });

    it("should extract correct Access Key", () => {
      expect(extractValue(normV1Text, p.accessKey)).toBe("32053092202434797000160000000000032726073934617378");
    });

    it("should extract correct Series Number", () => {
      expect(extractValue(normV1Text, p.seriesNumber)).toBe("70000");
    });

    it("should extract emission date and time", () => {
      expect(extractValue(normV1Text, p.emissionDate)).toBe("31/07/2026");
      expect(extractValue(normV1Text, p.emissionTime)).toBe("14:13:22");
    });

    it("should extract issuer details", () => {
      expect(extractValue(normV1Text, p.issuerName)).toBe("FATTO CONSULTORIA E SISTEMAS LTDA");
      expect(extractValue(normV1Text, p.issuerCNPJ)).toBe("02.434.797/0001-60");
      expect(extractValue(normV1Text, p.issuerAddress)).toBe("AVENIDA JERONIMO MONTEIRO, 1000, CENTRO");
      expect(extractValue(normV1Text, p.issuerCity)).toBe("Vitória");
      expect(extractValue(normV1Text, p.issuerState)).toBe("ES");
      expect(extractValue(normV1Text, p.issuerCEP)).toBe("29010-004");
    });

    it("should extract taker details", () => {
      expect(extractValue(normV1Text, p.takerName)).toBe("JOSE RODRIGO MONTAGNI");
      expect(extractValue(normV1Text, p.takerCNPJ)).toBe("276.621.768-19");
      expect(extractValue(normV1Text, p.takerAddress)).toBe("R LUIZ VIALTA, 149, RESIDENCIAL MONTE VERDE");
      expect(extractValue(normV1Text, p.takerCity)).toBe("Indaiatuba");
      expect(extractValue(normV1Text, p.takerState)).toBe("SP");
      expect(extractValue(normV1Text, p.takerCEP)).toBe("13348-865");
    });

    it("should extract service details", () => {
      expect(extractValue(normV1Text, p.serviceCode)).toBe("08.02.01 - Instrução, treinamento, orientação pedagógica e educacion...");
      expect(extractValue(normV1Text, p.serviceDescription)).toContain("PRORROGAÇÃO PCFPS");
    });

    it("should extract value details", () => {
      expect(extractValue(normV1Text, p.serviceValue, parseMonetaryValue)).toBe(27475);
      expect(extractValue(normV1Text, p.netValue, parseMonetaryValue)).toBe(27475);
    });

    it("should extract ISSQN details", () => {
      expect(extractValue(normV1Text, p.issqnBase, parseMonetaryValue)).toBe(27475);
      expect(extractValue(normV1Text, p.issqnApurado, parseMonetaryValue)).toBe(550);
      expect(extractValue(normV1Text, p.issqnAliquota)).toBe("2,00%");
      expect(extractValue(normV1Text, p.issqnSuspensao)).toBe("Não");
      expect(extractValue(normV1Text, p.issqnTributacao)).toBe("Tributável");
    });
  });

  describe("NFe 330 (v2.0) Pattern Matches", () => {
    const p = EXTRACTION_PATTERNS_V2;

    it("should extract correct NFS Number", () => {
      expect(extractValue(normV2Text, p.nfsNumber)).toBe("330");
    });

    it("should extract correct Access Key", () => {
      expect(extractValue(normV2Text, p.accessKey)).toBe("32053092202434797000160000000000033026082216865954");
    });

    it("should extract correct Series Number", () => {
      expect(extractValue(normV2Text, p.seriesNumber)).toBe("70000");
    });

    it("should extract emission date and time", () => {
      expect(extractValue(normV2Text, p.emissionDate)).toBe("04/08/2026");
      expect(extractValue(normV2Text, p.emissionTime)).toBe("12:49:25");
    });

    it("should extract issuer details", () => {
      expect(extractValue(normV2Text, p.issuerName)).toBe("FATTO CONSULTORIA E SISTEMAS LTDA");
      expect(extractValue(normV2Text, p.issuerCNPJ)).toBe("02.434.797/0001-60");
      expect(extractValue(normV2Text, p.issuerAddress)).toBe("AVENIDA JERONIMO MONTEIRO, 1000, CENTRO");
      expect(extractValue(normV2Text, p.issuerCity)).toBe("Vitória");
      expect(extractValue(normV2Text, p.issuerState)).toBe("ES");
      expect(extractValue(normV2Text, p.issuerCEP)).toBe("29.010-004");
    });

    it("should extract taker details", () => {
      expect(extractValue(normV2Text, p.takerName)).toBe("RENATA LIMA CANAVER RIBEIRO");
      expect(extractValue(normV2Text, p.takerCNPJ)).toBe("046.890.949-42");
      expect(extractValue(normV2Text, p.takerAddress)).toBe("AV CANDIDO HARTMANN, 4542, SANTA FELICIDADE");
      expect(extractValue(normV2Text, p.takerCity)).toBe("Curitiba");
      expect(extractValue(normV2Text, p.takerState)).toBe("PR");
      expect(extractValue(normV2Text, p.takerCEP)).toBe("82.015-100");
    });

    it("should extract service details", () => {
      expect(extractValue(normV2Text, p.serviceCode)).toBe("08.02.01");
      expect(extractValue(normV2Text, p.serviceDescription)).toContain("CAPF (30 DIAS)");
    });

    it("should extract value details", () => {
      expect(extractValue(normV2Text, p.serviceValue, parseMonetaryValue)).toBe(37500);
      expect(extractValue(normV2Text, p.netValue, parseMonetaryValue)).toBe(37500);
    });

    it("should extract ISSQN details", () => {
      expect(extractValue(normV2Text, p.issqnBase, parseMonetaryValue)).toBe(37500);
      expect(extractValue(normV2Text, p.issqnApurado, parseMonetaryValue)).toBe(750);
      expect(extractValue(normV2Text, p.issqnAliquota)).toBe("2,00 %");
      expect(extractValue(normV2Text, p.issqnTributacao)).toBe("Operação Tributável");
    });

    it("should extract IBS/CBS details", () => {
      expect(extractValue(normV2Text, p.ibsCbsCst)).toBe("- / -");
      expect(extractValue(normV2Text, p.ibsCbsBaseAposReducoes, parseMonetaryValue)).toBe(0);
      expect(extractValue(normV2Text, p.ibsAliquotaEfetivaMunicipal)).toBe("-");
      expect(extractValue(normV2Text, p.ibsValorApuradoMunicipal, parseMonetaryValue)).toBe(0);
      expect(extractValue(normV2Text, p.ibsAliquotaEfetivaEstadual)).toBe("-");
      expect(extractValue(normV2Text, p.ibsValorApuradoEstadual, parseMonetaryValue)).toBe(0);
      expect(extractValue(normV2Text, p.ibsValorTotalApurado, parseMonetaryValue)).toBe(0);
      expect(extractValue(normV2Text, p.cbsAliquota)).toBe("-");
      expect(extractValue(normV2Text, p.cbsValorTotalApurado, parseMonetaryValue)).toBe(0);
      expect(extractValue(normV2Text, p.totalIbsCbs, parseMonetaryValue)).toBe(0);
      expect(extractValue(normV2Text, p.netValueWithIbsCbs, parseMonetaryValue)).toBe(0);
    });
  });

  describe("cancellation tests", () => {
    it("should match SITUAÇÃO DA NFS-e Cancelada in v2.0", () => {
      const text = "SITUAÇÃO DA NFS-e NFS-e Cancelada";
      const match = text.match(EXTRACTION_PATTERNS_V2.cancellation);
      expect(match).toBeTruthy();
      expect(match![1]).toBe("NFS-e Cancelada");
    });
  });
});
