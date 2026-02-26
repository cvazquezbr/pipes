import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet
} from 'lucide-react';
import type { AggregatedWorkerData } from '@/lib/rendimentosExport';

interface RendimentosTableProps {
  data: AggregatedWorkerData[];
  processingYear: string;
  onCellClick: (worker: any, category: string) => void;
  onExport: () => void;
}

type SortConfig = {
  key: keyof AggregatedWorkerData | null;
  direction: 'asc' | 'desc';
};

export function RendimentosTable({
  data,
  processingYear,
  onCellClick,
  onExport
}: RendimentosTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

  const handleSort = (key: keyof AggregatedWorkerData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Filtering
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      result = result.filter(
        (w) =>
          w.nome.toLowerCase().includes(lowSearch) ||
          w.matricula.toLowerCase().includes(lowSearch) ||
          w.cpf.toLowerCase().includes(lowSearch)
      );
    }

    // Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortConfig]);

  const renderSortIcon = (key: keyof AggregatedWorkerData) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  const columns: { label: string; key: keyof AggregatedWorkerData; align?: 'left' | 'right' }[] = [
    { label: 'Matrícula', key: 'matricula', align: 'left' },
    { label: 'Nome', key: 'nome', align: 'left' },
    { label: 'CPF', key: 'cpf', align: 'left' },
    { label: 'Rend. Trib.', key: 'Rendimentos Tributáveis', align: 'right' },
    { label: 'Prev. Ofic.', key: 'Previdência Oficial', align: 'right' },
    { label: 'IRRF', key: 'IRRF (Mensal/Férias)', align: 'right' },
    { label: '13º Sal.', key: '13º Salário (Exclusiva)', align: 'right' },
    { label: 'IRRF 13º', key: 'IRRF sobre 13º (Exclusiva)', align: 'right' },
    { label: 'CP 13º', key: 'CP 13º Salário', align: 'right' },
    { label: 'PLR', key: 'PLR (Exclusiva)', align: 'right' },
    { label: 'IRRF PLR', key: 'IRRF sobre PLR (Exclusiva)', align: 'right' },
    { label: 'Plano Saúde', key: 'Desconto Plano de Saúde', align: 'right' },
    { label: 'Rend. Isentos', key: 'Rendimentos Isentos', align: 'right' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Filtrar por nome, matrícula ou CPF..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Button
          onClick={onExport}
          className="bg-green-600 hover:bg-green-700 w-full md:w-auto"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportar para Excel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Trabalhadores Processados ({filteredAndSortedData.length})
          </CardTitle>
          <CardDescription>
            Dados acumulados para o ano de {processingYear}
            {searchTerm && ` • Filtrando por "${searchTerm}"`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-auto rounded-md border text-[10px]">
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={`p-1 cursor-pointer hover:bg-slate-200 transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                      onClick={() => handleSort(col.key)}
                    >
                      <div className={`flex items-center ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                        {col.label}
                        {renderSortIcon(col.key)}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.length > 0 ? (
                  filteredAndSortedData.map((w, i) => (
                    <TableRow key={i} className="hover:bg-slate-50">
                      <TableCell className="p-1 font-mono">{w.matricula}</TableCell>
                      <TableCell className="p-1 truncate max-w-[100px]" title={w.nome}>
                        {w.nome}
                      </TableCell>
                      <TableCell className="p-1">{w.cpf}</TableCell>

                      {columns.slice(3).map((col) => (
                        <TableCell
                          key={col.key}
                          className="p-1 text-right cursor-pointer hover:bg-primary/10 hover:font-bold transition-all"
                          onClick={() => onCellClick(w, col.key as string)}
                        >
                          {(w[col.key] as number).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                      Nenhum resultado encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
