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
import { Button } from "@/components/ui/button";
import { Search, FileCode, Info, AlertTriangle } from "lucide-react";
import { JsonUpload } from "./JsonUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { parseValue, type WorkerData, type Folha, type ExtratoEntry, type Contracheque } from "@/lib/rendimentosExport";
import { Badge } from "@/components/ui/badge";

interface FolhaCCComparisonProps {
  workerData: WorkerData[];
  processingYear: string;
}

interface ComparisonResult {
  matricula: string;
  nome: string;
  ano: string | number;
  nomeFolha: string;
  valorLiquidoCC: number;
  valorLiquidoFolha: number;
  extratoEntry: ExtratoEntry;
  contracheque: Contracheque;
}

interface WorkerGroup {
  matricula: string;
  nome: string;
  matches: Record<string, ComparisonResult>;
}

export function FolhaCCComparison({ workerData, processingYear }: FolhaCCComparisonProps) {
  const [folhas, setFolhas] = useState<Folha[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<ComparisonResult | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get all unique payroll names for columns
  const payrollNames = useMemo(() => {
    const names = new Set<string>();
    folhas.forEach(f => {
      if (String(f.ano) === processingYear) {
        names.add(f.nomeFolha);
      }
    });
    return Array.from(names).sort();
  }, [folhas, processingYear]);

  const groupedData = useMemo(() => {
    if (folhas.length === 0) return [];

    const groups: Record<string, WorkerGroup> = {};

    workerData.forEach(worker => {
      worker.contracheques?.forEach(cc => {
        // Only consider contracheques of the processing year
        if (String(cc.ano) !== processingYear) return;

        // Find matching folha
        const matchingFolha = folhas.find(
          f => String(f.ano) === String(cc.ano) && f.nomeFolha === cc.nomeFolha
        );

        if (matchingFolha) {
          // Find matching extrato entry
          const extratoEntry = matchingFolha.extrato?.find(
            e => String(e.matricula).trim().replace(/^0+/, "") === String(worker.matricula).trim().replace(/^0+/, "")
          );

          if (extratoEntry) {
            if (!groups[worker.matricula]) {
              groups[worker.matricula] = {
                matricula: worker.matricula,
                nome: worker.nome,
                matches: {}
              };
            }

            groups[worker.matricula].matches[cc.nomeFolha || ""] = {
              matricula: worker.matricula,
              nome: worker.nome,
              ano: cc.ano,
              nomeFolha: cc.nomeFolha || "",
              valorLiquidoCC: parseValue(cc.valorLiquido || 0),
              valorLiquidoFolha: parseValue(extratoEntry.salarioLiquido || 0),
              extratoEntry,
              contracheque: cc
            };
          }
        }
      });
    });

    return Object.values(groups);
  }, [workerData, folhas, processingYear]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return groupedData;
    const lowSearch = searchTerm.toLowerCase();
    return groupedData.filter(
      d =>
        d.nome.toLowerCase().includes(lowSearch) ||
        d.matricula.toLowerCase().includes(lowSearch)
    );
  }, [groupedData, searchTerm]);

  const handleCellClick = (match: ComparisonResult) => {
    setSelectedMatch(match);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {folhas.length === 0 ? (
        <div className="max-w-2xl mx-auto">
          <JsonUpload
            title="Carga de Folhas para Conciliação"
            description="Carregue o arquivo JSON contendo as folhas e extratos para comparar com os contracheques."
            onFileLoaded={(data) => setFolhas(Array.isArray(data) ? data : [data])}
          />
        </div>
      ) : (
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold">Conciliação Folha x Contracheque</CardTitle>
                <CardDescription>
                  Comparativo de diferenças líquidas (Folha - CC) por tipo de folha para o ano {processingYear}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Filtrar trabalhador..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={() => setFolhas([])} size="sm">
                  Trocar Arquivo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border rounded-md bg-white overflow-hidden">
              <div className="max-h-[calc(100vh-350px)] overflow-auto text-[11px]">
                <Table>
                  <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="p-2 w-24">Matrícula</TableHead>
                      <TableHead className="p-2 min-w-[200px]">Nome</TableHead>
                      {payrollNames.map(name => (
                        <TableHead key={name} className="p-2 text-right">{name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? (
                      filteredData.map((worker, i) => (
                        <TableRow
                          key={i}
                          className="hover:bg-slate-50"
                        >
                          <TableCell className="p-2 font-mono">{worker.matricula}</TableCell>
                          <TableCell className="p-2 font-medium">{worker.nome}</TableCell>
                          {payrollNames.map(name => {
                            const match = worker.matches[name];
                            if (!match) return <TableCell key={name} className="p-2 text-right text-slate-300">-</TableCell>;

                            const diff = match.valorLiquidoFolha - match.valorLiquidoCC;
                            const hasDiff = Math.abs(diff) > 0.01;

                            return (
                              <TableCell
                                key={name}
                                className={`p-2 text-right font-mono cursor-pointer hover:bg-slate-200 transition-colors ${hasDiff ? "text-destructive font-bold" : "text-green-600"}`}
                                onClick={() => handleCellClick(match)}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  {hasDiff && <AlertTriangle className="h-3 w-3" />}
                                  {diff.toLocaleString("pt-BR", { minimumFractionDigits: 2, signDisplay: 'always' })}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={payrollNames.length + 2} className="h-24 text-center text-muted-foreground">
                          Nenhum registro encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col p-6">
          <DialogHeader>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-4">
              <div className="space-y-1">
                <DialogTitle className="text-xl">Detalhamento: {selectedMatch?.nome}</DialogTitle>
                <DialogDescription>
                  Conciliação para a folha <Badge variant="outline" className="font-bold">{selectedMatch?.nomeFolha}</Badge> ({selectedMatch?.ano})
                </DialogDescription>
              </div>

              <div className="flex gap-4">
                <div className="bg-slate-100 rounded-lg px-4 py-2 border">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Líquido Folha</div>
                  <div className="text-lg font-mono font-bold text-blue-700">
                    {selectedMatch?.valorLiquidoFolha.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-100 rounded-lg px-4 py-2 border">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Líquido CC</div>
                  <div className="text-lg font-mono font-bold text-primary">
                    {selectedMatch?.valorLiquidoCC.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className={`rounded-lg px-4 py-2 border ${(selectedMatch?.valorLiquidoFolha || 0) - (selectedMatch?.valorLiquidoCC || 0) !== 0 ? "bg-destructive/10 border-destructive/20" : "bg-green-50 border-green-200"}`}>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Diferença</div>
                  <div className={`text-lg font-mono font-bold ${Math.abs((selectedMatch?.valorLiquidoFolha || 0) - (selectedMatch?.valorLiquidoCC || 0)) > 0.01 ? "text-destructive" : "text-green-600"}`}>
                    {((selectedMatch?.valorLiquidoFolha || 0) - (selectedMatch?.valorLiquidoCC || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2, signDisplay: 'always' })}
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Left: Extrato Fields */}
            <div className="flex flex-col border rounded-md overflow-hidden bg-slate-50/30">
              <div className="p-2 bg-muted font-bold text-xs border-b flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                Campos do Extrato (Folha)
              </div>
              <div className="flex-1 overflow-auto p-2">
                <table className="w-full text-xs">
                  <tbody className="divide-y">
                    {selectedMatch && Object.entries(selectedMatch.extratoEntry).map(([key, value]) => (
                      <tr key={key} className="hover:bg-slate-100">
                        <td className="py-1.5 pr-4 font-semibold text-slate-500 w-1/3">{key}</td>
                        <td className="py-1.5 font-mono break-all">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Lancamentos CC */}
            <div className="flex flex-col border rounded-md overflow-hidden bg-slate-50/30">
              <div className="p-2 bg-muted font-bold text-xs border-b flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                Lançamentos do Contracheque
              </div>
              <div className="flex-1 overflow-auto">
                <Table className="text-[10px]">
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="p-2">Cód</TableHead>
                      <TableHead className="p-2">Descrição</TableHead>
                      <TableHead className="p-2 text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMatch?.contracheque.lancamentos?.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-100">
                        <TableCell className="p-2 font-mono">{item.codigo}</TableCell>
                        <TableCell className="p-2">{item.descricao}</TableCell>
                        <TableCell className="p-2 text-right font-mono">
                          {parseValue(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LayoutList(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
      <path d="M14 4h7" />
      <path d="M14 9h7" />
      <path d="M14 15h7" />
      <path d="M14 20h7" />
    </svg>
  );
}
