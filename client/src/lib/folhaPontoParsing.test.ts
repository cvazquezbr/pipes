
import { describe, it, expect, vi } from 'vitest';
import { parseWorkersExcel } from './folhaPonto';
import * as XLSX from 'xlsx';

// Mock XLSX
vi.mock('xlsx', async () => {
  const actual = await vi.importActual('xlsx');
  return {
    ...actual,
  };
});

describe('parseWorkersExcel', () => {
  it('should correctly parse workers with different column casing and spaces', async () => {
    // Create a mock workbook
    const data = [
      { ' Nome ': ' Thalles ', ' e-mail ': ' thalles@example.com ', ' CPF ': ' 123.456.789-00 ', ' Equipe ': ' EM - 4 ', ' Vínculo ': ' A ' },
      { 'Nome': 'Outro', 'Email': 'outro@example.com', 'CPF': '00011122233', 'equipe': 'Outra', 'Vinculo': 'X' } // Should be filtered out
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workers');

    // Mock the File object and its arrayBuffer method
    const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([excelBuffer], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const result = await parseWorkersExcel(file);

    expect(result.workers).toHaveLength(1);
    expect(result.workers[0]).toEqual({
      nome: 'Thalles',
      email: 'thalles@example.com',
      cpf: '12345678900',
      equipe: 'EM - 4'
    });
  });

  it('should invalidate incorrect email formats', async () => {
    const data = [
      { 'Nome': 'Invalid Email', 'e-mail': 'not-an-email', 'CPF': '11122233344', 'Equipe': 'Test' }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workers');

    const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([excelBuffer], 'test.xlsx');

    const result = await parseWorkersExcel(file);

    expect(result.workers[0].email).toBe('');
  });
});
