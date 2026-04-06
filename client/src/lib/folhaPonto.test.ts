
import { describe, it, expect } from 'vitest';
import { analyzePageCriticas } from './folhaPonto';

describe('folhaPonto analyzePageCriticas', () => {
  const options = { horasAdicionaisLimite: 2 };

  it('should identify FALTA NAO JUSTIFICADA', () => {
    const text = '10/05 SEX FALTA NAO JUSTIFICADA 00:00 00:00 -08:00';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Falta não justificada identificada no dia 10/05'))).toBe(true);
  });

  it('should identify odd number of clock-ins', () => {
    // Layout com pipe e múltiplos tempos
    const text = '11/05 SAB 08:00 12:00 13:00 | -04:00';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Inconsistência de batida (marcação ímpar) no dia 11/05'))).toBe(true);
  });

  it('should identify missing lunch break (Gabriel Marochi case)', () => {
    // 23/03 segunda-feira 08:00 23/03 -2:52 05:08 08:19 13:27
    // Nota: A extração pode ter uma ordem variada de tempos se não houver |
    const text = 'segunda-feira 08:00 23/03 -2:52 05:08 08:19 13:27';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Possível falta de intervalo de almoço no dia 23/03'))).toBe(true);
  });

  it('should identify negative balance (delay)', () => {
    const text = 'terça-feira 08:00 31/03 -2:51 05:09';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Atraso/Débito de horas registrado no dia 31/03 (-2:51)'))).toBe(true);
  });

  it('should identify excessive extra hours (> limit)', () => {
    const text = '13/05 SEG 08:00 12:00 13:00 20:00 +03:00 11:00';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Atenção: Mais de 2h adicionais realizadas no dia 13/05 (+03:00)'))).toBe(true);
  });

  it('should identify lunch break in normal 4-punch day', () => {
    const text = 'quarta-feira 08:00 25/03 00:42 08:42 13:33 14:25 17:02 08:00';
    const criticas = analyzePageCriticas(text, options);
    expect(criticas.some(c => c.mensagem.includes('Possível falta de intervalo de almoço'))).toBe(false);
  });

  it('should ignore admission date (Agnaldo Correia case)', () => {
    const text = 'CPF: 93501650310 Admissão: 17/02/2025 PONTOS 01/03 domingo 07:34 13:32 14:06 17:20';
    const criticas = analyzePageCriticas(text, options);
    // Should not have any critique for 17/02
    expect(criticas.some(c => c.dia === '17/02')).toBe(false);
    // Should still have data for 01/03 (if valid, here it's 4 punches so likely no error)
    expect(criticas.length).toBe(0);
  });

  it('should correctly process Fatto layout (Agnaldo case)', () => {
    // Texto simulando domingo (01/03) e segunda (02/03) no layout Fatto
    // domingo 01/03 -
    // 07:34 13:32 14:06 17:20 segunda-feira 08:00 02/03 01:12 09:12
    const text = 'domingo 01/03 - \n 07:34 13:32 14:06 17:20 segunda-feira 08:00 02/03 01:12 09:12';
    const criticas = analyzePageCriticas(text, options);

    // Should not flag 01/03 (Sunday)
    expect(criticas.some(c => c.dia === '01/03')).toBe(false);
    // Should not flag 02/03 (Monday) - 4 punches: 07:34, 13:32, 14:06, 17:20.
    // 08:00 is expected, 01:12 is balance, 09:12 is total.
    expect(criticas.some(c => c.dia === '02/03')).toBe(false);
  });
});
