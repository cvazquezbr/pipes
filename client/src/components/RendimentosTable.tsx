import { useState, useMemo, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  FileUp,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  FileText,
  LayoutList,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AggregatedWorkerData } from "@/lib/rendimentosExport";
import { extractInformesFromPDF, type ExtractedInforme } from "@/lib/informeExtractor";
import { toast } from "sonner";
import { PDFInformesTable } from "./PDFInformesTable";

interface RendimentosTableProps {
  data: AggregatedWorkerData[];
  extractedInformes: ExtractedInforme[];
  rawText?: string;
  processingYear: string;
  onCellClick: (worker: any, category: string) => void;
  onExport: () => void;
  onPDFLoaded?: (informes: ExtractedInforme[], rawText: string) => void;
}

type SortConfig = {
  key: keyof AggregatedWorkerData | null;
  direction: "asc" | "desc";
};

export function RendimentosTable({
  data,
  extractedInformes,
  rawText,
  processingYear,
  onCellClick,
  onExport,
  onPDFLoaded,
}: RendimentosTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [codeFilter, setCodeFilter] = useState("");

  const getPDFValueForCategory = (worker: AggregatedWorkerData, category: string): number | undefined => {
    if (!worker.pdfData) return undefined;

    switch (category) {
      case "Rendimentos Tributáveis": return worker.pdfData.totalRendimentos;
      case "Previdência Oficial": return worker.pdfData.previdenciaOficial;
      case "IRRF (Mensal/Férias)": return worker.pdfData.irrf;
      case "13º Salário (Exclusiva)": return worker.pdfData.decimoTerceiro;
      case "IRRF sobre 13º (Exclusiva)": return worker.pdfData.irrfDecimoTerceiro;
      case "PLR (Exclusiva)": return worker.pdfData.plr;
      case "Desconto Plano de Saúde": return worker.pdfData.planoSaude.reduce((acc, ps) => acc + ps.valor, 0);
      default: return undefined;
    }
  };

  const hasDivergence = (worker: AggregatedWorkerData): boolean => {
    if (!worker.pdfData) return false;

    const categories = [
      "Rendimentos Tributáveis",
      "Previdência Oficial",
      "IRRF (Mensal/Férias)",
      "13º Salário (Exclusiva)",
      "IRRF sobre 13º (Exclusiva)",
      "PLR (Exclusiva)",
      "Desconto Plano de Saúde"
    ];

    return categories.some(cat => {
      const jsonVal = worker[cat as keyof AggregatedWorkerData] as number;
      const pdfVal = getPDFValueForCategory(worker, cat);
      return pdfVal !== undefined && Math.abs(jsonVal - pdfVal) > 0.01;
    });
  };
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: "asc",
  });

  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF");
      return;
    }

    try {
      setIsUploadingPDF(true);
      const { informes, rawText: text } = await extractInformesFromPDF(file);
      if (informes.length === 0) {
        toast.warning(
          "Nenhum informe de rendimentos encontrado. Verifique se o PDF contém o campo 'Nome Completo' seguido de matrícula."
        );
        if (onPDFLoaded) onPDFLoaded(informes, text);
      } else {
        toast.success(`${informes.length} informes extraídos com sucesso`);
        if (onPDFLoaded) onPDFLoaded(informes, text);
      }
    } catch (error) {
      console.error("Erro ao processar PDF:", error);
      toast.error("Erro ao processar o arquivo PDF");
    } finally {
      setIsUploadingPDF(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSort = (key: keyof AggregatedWorkerData) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Filtering by text
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      result = result.filter(
        w =>
          w.nome.toLowerCase().includes(lowSearch) ||
          w.matricula.toLowerCase().includes(lowSearch) ||
          w.cpf.toLowerCase().includes(lowSearch)
      );
    }

    // Filtering by code
    if (codeFilter) {
      const trimmedCode = codeFilter.trim();
      result = result.filter(w =>
        w.allCodes.some(c => String(c) === trimmedCode)
      );
    }

    // Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const key = sortConfig.key!;
        const aValue = a[key] ?? "";
        const bValue = b[key] ?? "";

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
  }, [data, searchTerm, codeFilter, sortConfig]);

  const renderSortIcon = (key: keyof AggregatedWorkerData) => {
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
    key: keyof AggregatedWorkerData;
    align?: "left" | "right";
  }[] = [
    { label: "Status PDF", key: "pdfData" as any, align: "left" },
    { label: "Matrícula", key: "matricula", align: "left" },
    { label: "Nome", key: "nome", align: "left" },
    { label: "CPF", key: "cpf", align: "left" },
    { label: "Rend. Trib.", key: "Rendimentos Tributáveis", align: "right" },
    { label: "Prev. Ofic.", key: "Previdência Oficial", align: "right" },
    { label: "IRRF", key: "IRRF (Mensal/Férias)", align: "right" },
    { label: "Base Cálc. IRRF", key: "Base Cálculo IRRF", align: "right" },
    { label: "13º Sal.", key: "13º Salário (Exclusiva)", align: "right" },
    { label: "IRRF 13º", key: "IRRF sobre 13º (Exclusiva)", align: "right" },
    { label: "CP 13º", key: "CP 13º Salário", align: "right" },
    { label: "PLR", key: "PLR (Exclusiva)", align: "right" },
    { label: "IRRF PLR", key: "IRRF sobre PLR (Exclusiva)", align: "right" },
    { label: "Plano Saúde", key: "Desconto Plano de Saúde", align: "right" },
    { label: "Rend. Isentos", key: "Rendimentos Isentos", align: "right" },
  ];

  return (
    <Tabs defaultValue="conferencia" className="space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <TabsList>
          <TabsTrigger value="conferencia">Conferência JSON</TabsTrigger>
          <TabsTrigger value="pdf" className="relative">
            Extraído do PDF
            {extractedInformes.length > 0 && (
              <Badge className="ml-2 bg-primary/20 text-primary border-none text-[8px] h-4 px-1">
                {extractedInformes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="raw">Texto Bruto</TabsTrigger>
        </TabsList>

        <div className="flex gap-2 w-full md:max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Nome, matrícula ou CPF..."
              className="pl-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-32">
            <LayoutList className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Cód..."
              className="pl-9"
              value={codeFilter}
              onChange={e => setCodeFilter(e.target.value)}
              title="Filtrar por código de lançamento"
            />
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf"
            onChange={handlePDFUpload}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPDF}
            className="flex-1 md:flex-none"
          >
            {isUploadingPDF ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            Carga PDF Informe
          </Button>
          <Button
            onClick={onExport}
            className="bg-green-600 hover:bg-green-700 flex-1 md:flex-none"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar para Excel
          </Button>
        </div>
      </div>

      <TabsContent value="conferencia" className="space-y-4 mt-0">
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
                          {col.key !== ("pdfData" as any) &&
                            renderSortIcon(col.key)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedData.length > 0 ? (
                    filteredAndSortedData.map((w, i) => (
                      <TableRow key={i} className="hover:bg-slate-50">
                        <TableCell className="p-1">
                          {w.pdfData ? (
                            hasDivergence(w) ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 w-fit"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                Divergente
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1 w-fit"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                OK
                              </Badge>
                            )
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-slate-50 text-slate-400 border-slate-200 flex items-center gap-1 w-fit"
                            >
                              <AlertCircle className="h-3 w-3" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="p-1 font-mono">
                          {w.matricula}
                        </TableCell>
                        <TableCell
                          className="p-1 truncate max-w-[100px]"
                          title={w.nome}
                        >
                          {w.nome}
                        </TableCell>
                        <TableCell className="p-1">{w.cpf}</TableCell>

                        {columns.slice(4).map(col => {
                          const jsonVal = w[col.key as keyof AggregatedWorkerData] as number;
                          const pdfVal = getPDFValueForCategory(w, col.key as string);
                          const hasDiff = pdfVal !== undefined && Math.abs(jsonVal - pdfVal) > 0.01;
                          const diff = pdfVal !== undefined ? jsonVal - pdfVal : 0;

                          const content = (
                            <TableCell
                              key={col.key}
                              className={`p-1 text-right cursor-pointer hover:bg-primary/10 hover:font-bold transition-all ${hasDiff ? "text-destructive font-bold" : ""}`}
                              onClick={() => onCellClick(w, col.key as string)}
                            >
                              <div className="flex items-center justify-end gap-1">
                                {hasDiff && <AlertTriangle className="h-3 w-3" />}
                                {jsonVal.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                            </TableCell>
                          );

                          if (pdfVal !== undefined) {
                            return (
                              <TooltipProvider key={col.key}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    {content}
                                  </TooltipTrigger>
                                  <TooltipContent className="p-4 w-64 bg-white shadow-xl border-slate-200">
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b pb-1">
                                        <FileText className="h-3 w-3" />
                                        Comparação com Informe (PDF)
                                      </div>

                                      <div className="grid grid-cols-1 gap-2">
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] text-slate-500">Calculado (JSON)</span>
                                          <span className="text-sm font-mono font-bold">
                                            {jsonVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] text-slate-500">Extraído (PDF)</span>
                                          <span className="text-sm font-mono font-bold">
                                            {pdfVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>

                                        <div className="flex justify-between items-center border-t pt-2">
                                          <span className="text-[10px] text-slate-500 font-bold">Diferença</span>
                                          <span className={`text-sm font-mono font-bold ${hasDiff ? "text-destructive" : "text-green-600"}`}>
                                            {diff.toLocaleString("pt-BR", { minimumFractionDigits: 2, signDisplay: 'always' })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          }

                          return content;
                        })}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Nenhum resultado encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pdf" className="mt-0">
        <PDFInformesTable data={extractedInformes} />
      </TabsContent>

      <TabsContent value="raw" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Texto Bruto Extraído (Normalizado)
            </CardTitle>
            <CardDescription>
              Visualize o conteúdo textual do PDF para diagnosticar problemas
              de extração.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[500px] overflow-auto rounded-md border bg-slate-50 p-4 text-[10px] whitespace-pre-wrap font-mono">
              {rawText || "Nenhum PDF carregado ainda."}
            </pre>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
