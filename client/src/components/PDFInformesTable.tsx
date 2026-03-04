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
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  FileText
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ExtractedInforme } from "@/lib/informeExtractor";

interface PDFInformesTableProps {
  data: ExtractedInforme[];
}

type SortConfig = {
  key: keyof ExtractedInforme | "planoSaudeTotal" | null;
  direction: "asc" | "desc";
};

export function PDFInformesTable({ data }: PDFInformesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: "asc",
  });

  const handleSort = (key: keyof ExtractedInforme | "planoSaudeTotal") => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const dataWithTotals = useMemo(() => {
    return data.map(item => ({
      ...item,
      planoSaudeTotal: item.planoSaude.reduce((acc, curr) => acc + curr.valor, 0)
    }));
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    let result = [...dataWithTotals];

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
        const key = sortConfig.key!;
        const aValue = (a as any)[key] ?? "";
        const bValue = (b as any)[key] ?? "";

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
  }, [dataWithTotals, searchTerm, sortConfig]);

  const renderSortIcon = (key: keyof ExtractedInforme | "planoSaudeTotal") => {
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
    key: keyof ExtractedInforme | "planoSaudeTotal";
    align?: "left" | "right";
    className?: string;
  }[] = [
    { label: "Matrícula", key: "matricula", align: "left" },
    { label: "Nome", key: "nome", align: "left" },
    { label: "Rend. Trib.", key: "totalRendimentos", align: "right" },
    { label: "Prev. Ofic.", key: "previdenciaOficial", align: "right" },
    { label: "IRRF", key: "irrf", align: "right" },
    { label: "13º Sal.", key: "decimoTerceiro", align: "right" },
    { label: "IRRF 13º", key: "irrfDecimoTerceiro", align: "right" },
    { label: "PLR", key: "plr", align: "right" },
    { label: "Plano Saúde", key: "planoSaudeTotal", align: "right" },
    { label: "Rend. Isentos", key: "rendimentosIsentos", align: "right" },
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

      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-sm font-medium">
            Registros Extraídos do PDF ({filteredAndSortedData.length})
          </CardTitle>
          <CardDescription>
            Valores brutos capturados do Informe de Rendimentos
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px] border rounded-md bg-white overflow-hidden">
            <div className="flex-1 overflow-auto text-[10px]">
              <Table className="relative border-collapse w-full">
                <TableHeader className="bg-muted sticky top-0 z-30 shadow-sm">
                  <TableRow>
                    {columns.map((col, idx) => {
                      let stickyClass = "";
                      if (idx === 0) stickyClass = "sticky left-0 z-40 bg-muted shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[90px]";
                      if (idx === 1) stickyClass = "sticky left-[90px] z-40 bg-muted border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[200px]";

                      return (
                        <TableHead
                          key={col.key}
                          className={`p-2 cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"} ${stickyClass}`}
                          onClick={() => handleSort(col.key)}
                        >
                          <div
                            className={`flex items-center ${col.align === "right" ? "justify-end" : "justify-start"}`}
                          >
                            {col.label}
                            {renderSortIcon(col.key)}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedData.length > 0 ? (
                    filteredAndSortedData.map((w, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 group">
                        <TableCell className="p-2 font-mono sticky left-0 z-20 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[90px]">
                          {w.matricula}
                        </TableCell>
                        <TableCell
                          className="p-2 font-medium sticky left-[90px] z-20 bg-white group-hover:bg-slate-50 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate min-w-[200px] max-w-[250px]"
                          title={w.nome}
                        >
                          {w.nome}
                        </TableCell>

                        {columns.slice(2).map(col => {
                          const val = (w as any)[col.key] as number;

                          if (col.key === "planoSaudeTotal") {
                            return (
                              <TooltipProvider key={col.key}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <TableCell className="p-2 text-right font-mono cursor-help">
                                      <div className="flex items-center justify-end gap-1">
                                        {val !== 0 && <Info className="h-3 w-3 text-slate-400" />}
                                        {val.toLocaleString("pt-BR", {
                                          minimumFractionDigits: 2,
                                        })}
                                      </div>
                                    </TableCell>
                                  </TooltipTrigger>
                                  <TooltipContent className="p-4 w-64 bg-white shadow-xl border-slate-200 text-slate-900">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase border-b pb-1">
                                        <FileText className="h-3 w-3" />
                                        Beneficiários Plano Saúde
                                      </div>
                                      {w.planoSaude.length > 0 ? (
                                        <ul className="text-[10px] space-y-1">
                                          {w.planoSaude.map((ps, idx) => (
                                            <li key={idx} className="flex justify-between">
                                              <span className="truncate pr-2">{ps.beneficiario}</span>
                                              <span className="font-mono">
                                                {ps.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                              </span>
                                            </li>
                                          ))}
                                          <li className="border-t pt-1 flex justify-between font-bold">
                                            <span>TOTAL</span>
                                            <span>{val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                          </li>
                                        </ul>
                                      ) : (
                                        <p className="text-[10px]">Nenhum beneficiário listado.</p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          }

                          return (
                            <TableCell
                              key={col.key}
                              className="p-2 text-right font-mono whitespace-nowrap"
                            >
                              {val.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </TableCell>
                          );
                        })}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
