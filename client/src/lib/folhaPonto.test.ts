
import { describe, it, expect } from 'vitest';
import { analyzePageCriticas } from './folhaPonto';

describe('folhaPonto analyzePageCriticas', () => {
  const options = { horasAdicionaisLimite: 2, horasDebitoLimite: 2 };

  it('should identify FALTA NAO JUSTIFICADA', () => {
    const text = '10/05 SEX FALTA NAO JUSTIFICADA 00:00 00:00 -08:00';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Falta não justificada identificada no dia 10/05'))).toBe(true);
  });

  it('should identify odd number of clock-ins', () => {
    const text = '11/05 SAB 08:00 12:00 13:00 | -04:00';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Inconsistência de batida (marcação ímpar) no dia 11/05'))).toBe(true);
  });

  it('should NOT identify negative balance below debit limit', () => {
    // 03/03 with -00:07 balance and 02:00 limit should NOT alert
    const text = '07:33 13:31 | (m)14:10 16:05 | terça-feira 08:00 03/03 -00:07 07:53';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Atraso/Débito'))).toBe(false);
  });

  it('should identify negative balance ABOVE debit limit', () => {
    // -02:15 balance with 02:00 limit should alert
    const text = 'terça-feira 08:00 31/03 -02:15 05:45';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Atenção: Mais de 02:00h de débito registradas no dia 31/03 (-02:15)'))).toBe(true);
  });

  it('should identify excessive extra hours (> limit)', () => {
    const text = '13/05 SEG 08:00 12:00 13:00 20:00 +03:00 11:00';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Atenção: Mais de 02:00h adicionais realizadas no dia 13/05 (+03:00)'))).toBe(true);
  });

  it('should ignore footer date and "Página" text', () => {
    const footerText = '06/04/2026 13:31 51 Página 1 de';
    const criticas = analyzePageCriticas(footerText, options);
    expect(criticas.length).toBe(0);
  });

  describe('Work Interval Rules', () => {
    it('should alert if pause < 1h for worked > 6h', () => {
      // 08:00-12:00, 12:30-17:00 => 8.5h worked, 30min pause
      const text = 'segunda-feira 08:00 02/03 +00:30 08:30 08:00 12:00 12:30 17:00';
      const criticas = analyzePageCriticas(text, options);
      expect(criticas.some(c => c.mensagem.includes('Intervalo insuficiente no dia 02/03 (30min). Mínimo de 1h para jornada > 6h.'))).toBe(true);
    });

    it('should alert if pause > 2h for worked > 6h', () => {
      // 08:00-12:00, 15:00-19:00 => 8h worked, 3h pause
      const text = 'segunda-feira 08:00 02/03 +00:00 08:00 08:00 12:00 15:00 19:00';
      const criticas = analyzePageCriticas(text, options);
      expect(criticas.some(c => c.mensagem.includes('Intervalo excedente no dia 02/03 (180min). Máximo de 2h para jornada > 6h.'))).toBe(true);
    });

    it('should alert if pause < 15min for worked 4h-6h', () => {
      // 08:00-13:00 => 5h worked, 0 pause. Wait, 1 punch? No, 2 punches: 08:00 13:00
      const text = 'segunda-feira 08:00 02/03 -03:00 05:00 08:00 13:00';
      const criticas = analyzePageCriticas(text, options);
      // For 2 punches, it defaults to legacy if no interval found.
      // But here pause is 0.
      expect(criticas.some(c => c.mensagem.includes('Intervalo insuficiente no dia 02/03 (0min). Mínimo de 15min para jornada entre 4h e 6h.'))).toBe(true);
    });

    it('should NOT alert if pause is valid for worked > 6h', () => {
      // 08:00-12:00, 13:30-17:30 => 8h worked, 1.5h pause
      const text = 'segunda-feira 08:00 02/03 00:00 08:00 08:00 12:00 13:30 17:30';
      const criticas = analyzePageCriticas(text, options);
      expect(criticas.some(c => c.mensagem.includes('Intervalo'))).toBe(false);
    });

    it('should NOT alert if worked <= 4h', () => {
        // 08:00-11:00 => 3h worked, 0 pause
        const text = 'segunda-feira 08:00 02/03 -05:00 03:00 08:00 11:00';
        const criticas = analyzePageCriticas(text, options);
        expect(criticas.some(c => c.mensagem.includes('Intervalo'))).toBe(false);
    });
  });

  it('should identify lunch break in normal 4-punch day', () => {
    const text = 'quarta-feira 08:00 25/03 00:42 08:42 13:33 14:25 17:02 08:00';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Possível falta de intervalo de almoço'))).toBe(false);
  });
});
