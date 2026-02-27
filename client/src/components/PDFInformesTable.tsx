import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ExtractedInforme } from "@/lib/informeExtractor";

interface PDFInformesTableProps {
  data: ExtractedInforme[];
}

type SortConfig = {
  key: keyof ExtractedInforme | null;
  direction: "asc" | "desc";
};

export function PDFInformesTable({ data }: PDFInformesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: "asc",
  });

  const handleSort = (key: keyof ExtractedInforme) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Filtering
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      result = result.filter(
        w =>
          w.nome.toLowerCase().includes(lowSearch) ||
          w.matricula.toLowerCase().includes(lowSearch)
      );
    }

    // Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key!] || "";
        const bValue = b[sortConfig.key!] || "";

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortConfig]);

  const renderSortIcon = (key: keyof ExtractedInforme) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  const columns: {
    label: string;
    key: keyof ExtractedInforme;
    align?: "left" | "right";
  }[] = [
    { label: "Matrícula", key: "matricula", align: "left" },
    { label: "Nome", key: "nome", align: "left" },
    { label: "Rend. Trib.", key: "totalRendimentos", align: "right" },
    { label: "Prev. Ofic.", key: "previdenciaOficial", align: "right" },
    { label: "IRRF", key: "irrf", align: "right" },
    { label: "13º Sal.", key: "decimoTerceiro", align: "right" },
    { label: "IRRF 13º", key: "irrfDecimoTerceiro", align: "right" },
    { label: "PLR", key: "plr", align: "right" },
  ];

  return (
    <div className="space-y-4">
      <div className="relative w-full md:max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
        <Input
          placeholder="Filtrar por nome ou matrícula..."
          className="pl-9"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Registros Extraídos do PDF ({filteredAndSortedData.length})
          </CardTitle>
          <CardDescription>
            Valores brutos capturados do Informe de Rendimentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-auto rounded-md border text-[10px]">
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  {columns.map(col => (
                    <TableHead
                      key={col.key}
                      className={`p-1 cursor-pointer hover:bg-slate-200 transition-colors ${col.align === "right" ? "text-right" : "text-left"}`}
                      onClick={() => handleSort(col.key)}
                    >
                      <div
                        className={`flex items-center ${col.align === "right" ? "justify-end" : "justify-start"}`}
                      >
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
                      <TableCell className="p-1 font-mono">
                        {w.matricula}
                      </TableCell>
                      <TableCell
                        className="p-1 truncate max-w-[150px]"
                        title={w.nome}
                      >
                        {w.nome}
                      </TableCell>

                      {columns.slice(2).map(col => (
                        <TableCell
                          key={col.key}
                          className="p-1 text-right"
                        >
                          {(w[col.key] as number).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nenhum registro encontrado no PDF.
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
