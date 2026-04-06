
import { describe, it, expect } from 'vitest';
import { analyzePageCriticas } from './folhaPonto';

describe('folhaPonto analyzePageCriticas', () => {
  it('should identify FALTA NAO JUSTIFICADA', () => {
    const text = '10/05 SEX FALTA NAO JUSTIFICADA 00:00 00:00 -08:00';
    const criticas = analyzePageCriticas(text, { horasAdicionaisLimite: 2 });
    expect(criticas.some(c => c.mensagem.includes('Falta não justificada identificada no dia 10/05'))).toBe(true);
  });

  it('should identify odd number of clock-ins', () => {
    const text = '11/05 SAB 08:00 12:00 13:00 -04:00';
    const criticas = analyzePageCriticas(text, { horasAdicionaisLimite: 2 });
    expect(criticas.some(c => c.mensagem.includes('Inconsistência de batida (marcação ímpar) no dia 11/05'))).toBe(true);
  });

  it('should identify negative balance (delay)', () => {
    const text = '12/05 DOM 08:15 12:00 13:00 17:00 -00:15';
    const criticas = analyzePageCriticas(text, { horasAdicionaisLimite: 2 });
    expect(criticas.some(c => c.mensagem.includes('Atraso/Débito de horas registrado no dia 12/05 (-00:15)'))).toBe(true);
  });

  it('should identify excessive extra hours (> limit)', () => {
    const text = '13/05 SEG 08:00 12:00 13:00 20:00 +03:00';
    const criticas = analyzePageCriticas(text, { horasAdicionaisLimite: 2 });
    expect(criticas.some(c => c.mensagem.includes('Atenção: Mais de 2h adicionais realizadas no dia 13/05 (+03:00)'))).toBe(true);
  });

  it('should not flag positive balance within limit', () => {
    const text = '14/05 TER 08:00 12:00 13:00 18:30 +01:30';
    const criticas = analyzePageCriticas(text, { horasAdicionaisLimite: 2 });
    expect(criticas).not.toContain('Atenção: Mais de 2h extras realizadas no dia 14/05 (+01:30)');
  });
});
