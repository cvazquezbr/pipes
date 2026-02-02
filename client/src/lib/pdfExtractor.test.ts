import { describe, it, expect } from 'vitest';
import { EXTRACTION_PATTERNS } from './extractionPatterns';

describe('pdfExtractor patterns', () => {
  describe('issuerCNPJ', () => {
    it('should match CNPJ format', () => {
      const text = 'EMITENTE DA NFS-e ... CNPJ / CPF / NIF 02.434.797/0001-60';
      const match = text.match(EXTRACTION_PATTERNS.issuerCNPJ);
      expect(match).toBeTruthy();
      expect(match![1]).toBe('02.434.797/0001-60');
    });

    it('should match CPF format', () => {
      const text = 'EMITENTE DA NFS-e ... CNPJ / CPF / NIF 927.877.384-00';
      const match = text.match(EXTRACTION_PATTERNS.issuerCNPJ);
      expect(match).toBeTruthy();
      expect(match![1]).toBe('927.877.384-00');
    });
  });

  describe('takerCNPJ', () => {
    it('should match CNPJ format', () => {
      const text = 'TOMADOR DO SERVIÇO ... CNPJ / CPF / NIF 02.434.797/0001-60';
      const match = text.match(EXTRACTION_PATTERNS.takerCNPJ);
      expect(match).toBeTruthy();
      expect(match![1]).toBe('02.434.797/0001-60');
    });

    it('should match CPF format', () => {
      const text = 'TOMADOR DO SERVIÇO ... CNPJ / CPF / NIF 927.877.384-00';
      const match = text.match(EXTRACTION_PATTERNS.takerCNPJ);
      expect(match).toBeTruthy();
      expect(match![1]).toBe('927.877.384-00');
    });
  });
});
