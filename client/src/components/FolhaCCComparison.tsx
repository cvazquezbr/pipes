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
import { Search, FileCode, Info } from "lucide-react";
import { JsonUpload } from "./JsonUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { parseValue, type WorkerData, type Folha, type ExtratoEntry, type Contracheque } from "@/lib/rendimentosExport";

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

export function FolhaCCComparison({ workerData, processingYear }: FolhaCCComparisonProps) {
  const [folhas, setFolhas] = useState<Folha[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<ComparisonResult | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const comparisonData = useMemo(() => {
    if (folhas.length === 0) return [];

    const results: ComparisonResult[] = [];

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
            results.push({
              matricula: worker.matricula,
              nome: worker.nome,
              ano: cc.ano,
              nomeFolha: cc.nomeFolha || "",
              valorLiquidoCC: parseValue(cc.valorLiquido || 0),
              valorLiquidoFolha: parseValue(extratoEntry.salarioLiquido || 0),
              extratoEntry,
              contracheque: cc
            });
          }
        }
      });
    });

    return results;
  }, [workerData, folhas, processingYear]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return comparisonData;
    const lowSearch = searchTerm.toLowerCase();
    return comparisonData.filter(
      d =>
        d.nome.toLowerCase().includes(lowSearch) ||
        d.matricula.toLowerCase().includes(lowSearch) ||
        d.nomeFolha.toLowerCase().includes(lowSearch)
    );
  }, [comparisonData, searchTerm]);

  const handleRowClick = (match: ComparisonResult) => {
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
                  Comparativo de valores líquidos entre a folha e o contracheque para o ano {processingYear}
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
                      <TableHead className="p-2">Matrícula</TableHead>
                      <TableHead className="p-2">Nome</TableHead>
                      <TableHead className="p-2">Folha</TableHead>
                      <TableHead className="p-2 text-right">Líquido CC</TableHead>
                      <TableHead className="p-2 text-right">Líquido Folha</TableHead>
                      <TableHead className="p-2 text-right">Diferença</TableHead>
                      <TableHead className="p-2 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? (
                      filteredData.map((d, i) => {
                        const diff = d.valorLiquidoFolha - d.valorLiquidoCC;
                        const hasDiff = Math.abs(diff) > 0.01;
                        return (
                          <TableRow
                            key={i}
                            className="hover:bg-slate-50 cursor-pointer"
                            onClick={() => handleRowClick(d)}
                          >
                            <TableCell className="p-2 font-mono">{d.matricula}</TableCell>
                            <TableCell className="p-2 font-medium">{d.nome}</TableCell>
                            <TableCell className="p-2">{d.nomeFolha}</TableCell>
                            <TableCell className="p-2 text-right font-mono">
                              {d.valorLiquidoCC.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="p-2 text-right font-mono">
                              {d.valorLiquidoFolha.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className={`p-2 text-right font-mono font-bold ${hasDiff ? "text-destructive" : "text-green-600"}`}>
                              {diff.toLocaleString("pt-BR", { minimumFractionDigits: 2, signDisplay: 'always' })}
                            </TableCell>
                            <TableCell className="p-2">
                              <Info className="h-4 w-4 text-slate-400" />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhamento: {selectedMatch?.nome}</DialogTitle>
            <DialogDescription>
              Comparação detalhada entre Extrato da Folha e Lançamentos do Contracheque ({selectedMatch?.nomeFolha})
            </DialogDescription>
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
              <div className="p-2 bg-muted/50 border-t flex justify-between items-center text-xs font-bold">
                <span>Líquido Informado:</span>
                <span className="font-mono">
                  {selectedMatch?.valorLiquidoCC.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
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
