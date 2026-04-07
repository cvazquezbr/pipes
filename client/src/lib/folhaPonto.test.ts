
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
      const text = '08:00 12:00 12:30 17:00 segunda-feira 08:00 02/03 +00:30 08:30';
      const criticas = analyzePageCriticas(text, options);
      expect(criticas.some(c => c.mensagem.includes('Intervalo insuficiente no dia 02/03 (30min). Mínimo de 1h para jornada > 6h.'))).toBe(true);
    });

    it('should alert if pause > 2h for worked > 6h', () => {
      // 08:00-12:00, 15:00-19:00 => 8h worked, 3h pause
      const text = '08:00 12:00 15:00 19:00 segunda-feira 08:00 02/03 +00:00 08:00';
      const criticas = analyzePageCriticas(text, options);
      expect(criticas.some(c => c.mensagem.includes('Intervalo excedente no dia 02/03 (180min). Máximo de 2h para jornada > 6h.'))).toBe(true);
    });

    it('should alert if pause < 15min for worked 4h-6h', () => {
      // 08:00-13:00 => 5h worked, 0 pause. Wait, 1 punch? No, 2 punches: 08:00 13:00
      const text = '08:00 13:00 segunda-feira 08:00 02/03 -03:00 05:00';
      const criticas = analyzePageCriticas(text, options);
      expect(criticas.some(c => c.mensagem.includes('Intervalo insuficiente no dia 02/03 (0min). Mínimo de 15min para jornada entre 4h e 6h.'))).toBe(true);
    });

    it('should correctly identify punches on 04/03 (Agnaldo case)', () => {
        // 07:32 13:21 | 14:10 16:12 | quarta-feira 08:00 04/03 -00:09 07:51
        // Pause: 13:21 to 14:10 = 49 min.
        // Jornada: 07:51 (> 6h). Required: 1h. Result: "Intervalo insuficiente".
        const text = '07:32 13:21 | 14:10 16:12 | quarta-feira 08:00 04/03 -00:09 07:51';
        const criticas = analyzePageCriticas(text, options);
        expect(criticas.some(c => c.mensagem.includes('Intervalo insuficiente no dia 04/03 (49min)'))).toBe(true);
        // It should NOT be "Intervalo excedente"
        expect(criticas.some(c => c.mensagem.includes('excedente'))).toBe(false);
    });

    it('should NOT alert if pause is valid for worked > 6h', () => {
      // 08:00-12:00, 13:30-17:30 => 8h worked, 1.5h pause
      const text = '08:00 12:00 13:30 17:30 segunda-feira 08:00 02/03 00:00 08:00';
      const criticas = analyzePageCriticas(text, options);
      expect(criticas.some(c => c.mensagem.includes('Intervalo'))).toBe(false);
    });

    it('should NOT alert if worked <= 4h', () => {
        // 08:00-11:00 => 3h worked, 0 pause
        const text = '08:00 11:00 segunda-feira 08:00 02/03 -05:00 03:00';
        const criticas = analyzePageCriticas(text, options);
        expect(criticas.some(c => c.mensagem.includes('Intervalo'))).toBe(false);
    });
  });

  it('should identify lunch break in normal 4-punch day', () => {
    const text = 'quarta-feira 08:00 25/03 00:42 08:42 13:33 14:25 17:02 08:00';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Possível falta de intervalo de almoço'))).toBe(false);
  });

  describe('Complex Layout Cases (Yascara Case)', () => {
    it('should NOT identify odd punches on 18/03 (4 punches, zero balance)', () => {
        // (m)08:00 12:00 | (m)13:00 17:00 | quarta-feira 08:00 18/03 08:00
        const text = '(m)08:00 12:00 | (m)13:00 17:00 | quarta-feira 08:00 18/03 08:00';
        const criticas = analyzePageCriticas(text, options);
        expect(criticas.length).toBe(0);
    });

    it('should NOT identify odd punches on 23/03', () => {
        const text = '(m)08:00 12:00 | (m)13:00 17:00 | segunda-feira 08:00 23/03 08:00';
        const criticas = analyzePageCriticas(text, options);
        expect(criticas.length).toBe(0);
    });

    it('should identify even punches correctly on 31/03 (2 punches, negative balance)', () => {
        // (m)07:55 14:33 | terça-feira 08:00 31/03 -1:22 06:38
        const text = '(m)07:55 14:33 | terça-feira 08:00 31/03 -1:22 06:38';
        const criticas = analyzePageCriticas(text, options);
        // Jornada de 06:38 (> 6h). Intervalo de 0 min. Deveria ter alerta de intervalo.
        expect(criticas.some(c => c.mensagem.includes('Intervalo insuficiente'))).toBe(true);
        // Mas NÃO deveria ter inconsistência de batida (são 2 batidas)
        expect(criticas.some(c => c.mensagem.includes('Inconsistência de batida'))).toBe(false);
    });

    it('should handle 06/03 (4 punches, negative balance with space)', () => {
        // (m)08:03 12:44 | (m)13:44 14:40 | sexta-feira 08:00 06/03 -2:23 05:37
        const text = '(m)08:03 12:44 | (m)13:44 14:40 | sexta-feira 08:00 06/03 -2:23 05:37';
        const criticas = analyzePageCriticas(text, options);
        // Saldo -2:23 é maior que limite de 2h.
        expect(criticas.some(c => c.mensagem.includes('Mais de 02:00h de débito'))).toBe(true);
        expect(criticas.some(c => c.mensagem.includes('Inconsistência de batida'))).toBe(false);
    });
  });
});
