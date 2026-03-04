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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  CalendarDays,
  Calendar,
  ChevronRight,
  Check,
  X,
  FileWarning,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type AggregatedWorkerData,
  type WorkerData,
  type Gozo,
  getPDFValueForCategory,
  hasDivergence,
} from "@/lib/rendimentosExport";
import { extractInformesFromPDF, type ExtractedInforme } from "@/lib/informeExtractor";
import { toast } from "sonner";
import { PDFInformesTable } from "./PDFInformesTable";
import { FolhaCCComparison } from "./FolhaCCComparison";

interface RendimentosTableProps {
  data: AggregatedWorkerData[];
  allWorkers: WorkerData[];
  extractedInformes: ExtractedInforme[];
  rawText?: string;
  processingYear: string;
  onCellClick: (worker: any, category: string) => void;
  onViewAllEntries?: (worker: AggregatedWorkerData) => void;
  onViewGozos?: (worker: AggregatedWorkerData) => void;
  onExport: () => void;
  onExportDivergences: () => void;
  onPDFLoaded?: (informes: ExtractedInforme[], rawText: string) => void;
}

type SortConfig = {
  key: keyof AggregatedWorkerData | null;
  direction: "asc" | "desc";
};

export function RendimentosTable({
  data,
  allWorkers,
  extractedInformes,
  rawText,
  processingYear,
  onCellClick,
  onViewAllEntries,
  onViewGozos,
  onExport,
  onExportDivergences,
  onPDFLoaded,
}: RendimentosTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [onlyDivergent, setOnlyDivergent] = useState(false);
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: "asc",
  });
  const [selectedFeriasGroup, setSelectedFeriasGroup] = useState<any>(null);

  const aggregatedGozos = useMemo(() => {
    const groups: Record<string, {
      key: string;
      total: number;
      assinado: number;
      realizado: number;
      semLinkAvisoAssinado: number;
      semLinkAviso: number;
      items: { workerName: string; matricula: string; gozo: Gozo }[];
    }> = {};

    allWorkers.forEach(worker => {
      worker.periodosAquisitivos?.forEach(pa => {
        pa.gozos?.forEach(gozo => {
          let key = "Sem Data de Pagamento";
          if (gozo.Pagamento) {
            const parts = gozo.Pagamento.split("-");
            if (parts.length >= 2) {
              key = `${parts[0]}-${parts[1]}`;
            }
          }

          if (!groups[key]) {
            groups[key] = {
              key,
              total: 0,
              assinado: 0,
              realizado: 0,
              semLinkAvisoAssinado: 0,
              semLinkAviso: 0,
              items: [],
            };
          }

          const g = groups[key];
          g.total++;
          if (gozo.assinado === true) g.assinado++;
          if (gozo.realizado === true) g.realizado++;
          if (!gozo.linkAvisoAssinado) g.semLinkAvisoAssinado++;
          if (!gozo.linkAviso) g.semLinkAviso++;
          g.items.push({
            workerName: worker.nome,
            matricula: worker.matricula,
            gozo,
          });
        });
      });
    });

    return Object.values(groups).sort((a, b) => {
      if (a.key === "Sem Data de Pagamento") return 1;
      if (b.key === "Sem Data de Pagamento") return -1;
      return b.key.localeCompare(a.key);
    });
  }, [allWorkers]);

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

    // Filter by divergence
    if (onlyDivergent) {
      result = result.filter(w => hasDivergence(w));
    }

    // Filtering by text
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      result = result.filter(
        w =>
          w.nome.toLowerCase().includes(lowSearch) ||
          w.matricula.toLowerCase().includes(lowSearch)
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
  }, [data, searchTerm, codeFilter, sortConfig, onlyDivergent]);

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
    { label: "Ações", key: "actions" as any, align: "left" },
    { label: "Status PDF", key: "pdfData" as any, align: "left" },
    { label: "Matrícula", key: "matricula", align: "left" },
    { label: "Nome", key: "nome", align: "left" },
    { label: "Rend. Trib.", key: "Rendimentos Tributáveis", align: "right" },
    { label: "Prev. Ofic.", key: "Previdência Oficial", align: "right" },
    { label: "IRRF", key: "IRRF (Mensal/Férias)", align: "right" },
    { label: "13º Sal.", key: "13º Salário (Exclusiva)", align: "right" },
    { label: "IRRF 13º", key: "IRRF sobre 13º (Exclusiva)", align: "right" },
    { label: "CP 13º", key: "CP 13º Salário", align: "right" },
    { label: "PLR", key: "PLR (Exclusiva)", align: "right" },
    { label: "Plano Saúde", key: "Desconto Plano de Saúde", align: "right" },
    { label: "Rend. Isentos", key: "Rendimentos Isentos", align: "right" },
  ];

  return (
    <Tabs defaultValue="conferencia" className="space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 sticky top-[57px] z-30 bg-slate-50/80 backdrop-blur-sm py-2">
        <TabsList className="bg-slate-200/50">
          <TabsTrigger value="conferencia">Conferência JSON</TabsTrigger>
          <TabsTrigger value="pdf" className="relative">
            Extraído do PDF
            {extractedInformes.length > 0 && (
              <Badge className="ml-2 bg-primary/20 text-primary border-none text-[8px] h-4 px-1">
                {extractedInformes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ferias">Férias</TabsTrigger>
          <TabsTrigger value="folhacc">Folha x CC</TabsTrigger>
          <TabsTrigger value="raw">Texto Bruto</TabsTrigger>
        </TabsList>

        <div className="flex gap-2 w-full md:max-w-2xl items-center">
          <div className="flex items-center space-x-2 mr-2 min-w-fit">
            <Switch
              id="divergent-filter"
              checked={onlyDivergent}
              onCheckedChange={setOnlyDivergent}
            />
            <Label htmlFor="divergent-filter" className="text-xs font-medium cursor-pointer">
              Apenas Divergentes
            </Label>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Nome ou matrícula..."
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
            onClick={onExportDivergences}
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 flex-1 md:flex-none"
          >
            <FileWarning className="mr-2 h-4 w-4" />
            Exportar Divergências
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

      <TabsContent value="conferencia" className="mt-0">
        <Card className="border-none shadow-none bg-transparent">
          <CardContent className="p-0">
            <div className="flex flex-col h-[calc(100vh-320px)] min-h-[400px] border rounded-md bg-white overflow-hidden">
              <div className="flex-none p-3 border-b bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Trabalhadores Processados ({filteredAndSortedData.length})
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Dados acumulados para o ano de {processingYear}
                    {searchTerm && ` • Filtrando por "${searchTerm}"`}
                  </p>
                </div>
              </div>
              <div className="flex-1 text-[10px] overflow-hidden">
                <Table
                  className="relative border-collapse w-full"
                  containerClassName="h-full overflow-auto"
                >
                  <TableHeader className="bg-muted sticky top-0 z-30 shadow-sm">
                    <TableRow>
                      {columns.map((col, idx) => {
                        let stickyClass = "";
                        if (idx === 0) stickyClass = "sticky left-0 z-40 bg-muted shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[60px]";
                        if (idx === 1) stickyClass = "sticky left-[60px] z-40 bg-muted shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[100px]";
                        if (idx === 2) stickyClass = "sticky left-[160px] z-40 bg-muted shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[80px]";
                        if (idx === 3) stickyClass = "sticky left-[240px] z-40 bg-muted border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[150px]";

                        return (
                          <TableHead
                            key={col.key}
                            className={`p-1 cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"} ${stickyClass}`}
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
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredAndSortedData.length > 0 ? (
                    filteredAndSortedData.map((w, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 group">
                        <TableCell className="p-1 sticky left-0 z-20 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[60px]">
                          <div className="flex items-center justify-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => onViewAllEntries?.(w)}
                                  >
                                    <LayoutList className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Ver todos os lançamentos
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => onViewGozos?.(w)}
                                  >
                                    <CalendarDays className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Ver períodos de gozo
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                        <TableCell className="p-1 sticky left-[60px] z-20 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[100px]">
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
                        <TableCell className="p-1 font-mono sticky left-[160px] z-20 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[80px]">
                          {w.matricula}
                        </TableCell>
                        <TableCell
                          className="p-1 truncate sticky left-[240px] z-20 bg-white group-hover:bg-slate-50 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[150px] max-w-[200px]"
                          title={w.nome}
                        >
                          {w.nome}
                        </TableCell>

                        {columns.slice(4).map(col => {
                          const jsonVal = w[col.key as keyof AggregatedWorkerData] as number;
                          const pdfVal = getPDFValueForCategory(w, col.key as string);
                          const hasDiff = pdfVal !== undefined && Math.abs(jsonVal - pdfVal) > 0.01;
                          const diff = pdfVal !== undefined ? pdfVal - jsonVal : 0;

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
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pdf" className="mt-0">
        <PDFInformesTable data={extractedInformes} />
      </TabsContent>

      <TabsContent value="folhacc" className="mt-0">
        <FolhaCCComparison workerData={allWorkers} processingYear={processingYear} />
      </TabsContent>

      <TabsContent value="ferias" className="mt-0">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <Card className="md:col-span-5 lg:col-span-4 border shadow-sm">
            <CardHeader className="pb-3 bg-slate-50/50 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Agregado de Férias
              </CardTitle>
              <CardDescription className="text-[10px]">
                Agrupado por Ano/Mês de Pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="max-h-[calc(100vh-320px)] overflow-auto text-[10px]">
                  <Table className="relative">
                    <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="p-2">Período</TableHead>
                        <TableHead className="p-2 text-right">Total</TableHead>
                        <TableHead className="p-2 text-right" title="Assinado">Assin.</TableHead>
                        <TableHead className="p-2 text-right" title="Realizado">Real.</TableHead>
                        <TableHead className="p-2 text-right" title="Sem Link Aviso Assinado">S/L.Assin</TableHead>
                        <TableHead className="p-2 text-right" title="Sem Link Aviso">S/Link</TableHead>
                        <TableHead className="p-2 w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aggregatedGozos.map((group) => (
                        <TableRow
                          key={group.key}
                          className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedFeriasGroup?.key === group.key ? 'bg-primary/10 font-bold' : ''}`}
                          onClick={() => setSelectedFeriasGroup(group)}
                        >
                          <TableCell className="p-2 font-medium">{group.key}</TableCell>
                          <TableCell className="p-2 text-right font-mono">{group.total}</TableCell>
                          <TableCell className="p-2 text-right font-mono text-green-600">{group.assinado}</TableCell>
                          <TableCell className="p-2 text-right font-mono text-blue-600">{group.realizado}</TableCell>
                          <TableCell className="p-2 text-right font-mono text-orange-600">{group.semLinkAvisoAssinado}</TableCell>
                          <TableCell className="p-2 text-right font-mono text-amber-600">{group.semLinkAviso}</TableCell>
                          <TableCell className="p-2 text-right">
                            <ChevronRight className={`h-4 w-4 transition-transform ${selectedFeriasGroup?.key === group.key ? 'translate-x-1 text-primary' : 'opacity-20'}`} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
               </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-7 lg:col-span-8 border shadow-sm overflow-hidden">
             <CardHeader className="pb-3 bg-slate-50/50 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">
                    {selectedFeriasGroup ? `Detalhes: ${selectedFeriasGroup.key}` : "Selecione um período"}
                  </CardTitle>
                  {selectedFeriasGroup && (
                     <CardDescription className="text-[10px]">
                        {selectedFeriasGroup.total} registros de gozo encontrados
                     </CardDescription>
                  )}
                </div>
                {selectedFeriasGroup && (
                  <div className="flex gap-2">
                     <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200">
                       Assinados: {selectedFeriasGroup.assinado}
                     </Badge>
                     <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                       Realizados: {selectedFeriasGroup.realizado}
                     </Badge>
                  </div>
                )}
             </CardHeader>
             <CardContent className="p-0">
                {selectedFeriasGroup ? (
                   <div className="max-h-[calc(100vh-320px)] overflow-auto text-[10px]">
                      <Table className="relative">
                         <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                            <TableRow>
                               <TableHead className="p-2">Matrícula</TableHead>
                               <TableHead className="p-2">Nome</TableHead>
                               <TableHead className="p-2">Início</TableHead>
                               <TableHead className="p-2">Pagto</TableHead>
                               <TableHead className="p-2 text-center">Assin.</TableHead>
                               <TableHead className="p-2 text-center">Realiz.</TableHead>
                               <TableHead className="p-2 text-center">Status Links</TableHead>
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                            {selectedFeriasGroup.items.map((item: any, idx: number) => (
                               <TableRow key={idx} className="hover:bg-slate-50 group">
                                  <TableCell className="p-2 font-mono">{item.matricula}</TableCell>
                                  <TableCell className="p-2 truncate max-w-[200px]" title={item.workerName}>
                                    {item.workerName}
                                  </TableCell>
                                  <TableCell className="p-2">{item.gozo.Inicio || '-'}</TableCell>
                                  <TableCell className="p-2">{item.gozo.Pagamento || '-'}</TableCell>
                                  <TableCell className="p-2 text-center">
                                     {item.gozo.assinado ? (
                                       <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" />
                                     ) : (
                                       <X className="h-3.5 w-3.5 text-slate-300 mx-auto" />
                                     )}
                                  </TableCell>
                                  <TableCell className="p-2 text-center">
                                     {item.gozo.realizado ? (
                                       <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" />
                                     ) : (
                                       <X className="h-3.5 w-3.5 text-slate-300 mx-auto" />
                                     )}
                                  </TableCell>
                                  <TableCell className="p-2 text-center">
                                     <div className="flex items-center justify-center gap-1.5">
                                        <TooltipProvider>
                                          {!item.gozo.linkAviso ? (
                                            <Tooltip>
                                              <TooltipTrigger>
                                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                              </TooltipTrigger>
                                              <TooltipContent>Sem linkAviso</TooltipContent>
                                            </Tooltip>
                                          ) : null}
                                          {!item.gozo.linkAvisoAssinado ? (
                                            <Tooltip>
                                              <TooltipTrigger>
                                                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                                              </TooltipTrigger>
                                              <TooltipContent>Sem linkAvisoAssinado</TooltipContent>
                                            </Tooltip>
                                          ) : null}
                                          {item.gozo.linkAviso && item.gozo.linkAvisoAssinado && (
                                            <Check className="h-3.5 w-3.5 text-green-600" />
                                          )}
                                        </TooltipProvider>
                                     </div>
                                  </TableCell>
                               </TableRow>
                            ))}
                         </TableBody>
                      </Table>
                   </div>
                ) : (
                  <div className="h-[400px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                     <Calendar className="h-12 w-12 mb-4 opacity-10" />
                     <p className="text-sm font-medium">Selecione um período à esquerda para ver os detalhes</p>
                  </div>
                )}
             </CardContent>
          </Card>
        </div>
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
