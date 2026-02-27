import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ListFilter, Copy } from "lucide-react";
import type { AggregatedWorkerData } from "@/lib/rendimentosExport";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface WorkerEntriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker: AggregatedWorkerData | null;
}

export function WorkerEntriesDialog({
  open,
  onOpenChange,
  worker,
}: WorkerEntriesDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEntries = useMemo(() => {
    if (!worker) return [];
    if (!searchTerm) return worker.allEntries;

    const lowerSearch = searchTerm.toLowerCase();
    return worker.allEntries.filter(
      (entry) =>
        entry.origem.toLowerCase().includes(lowerSearch) ||
        String(entry.codigo || "").toLowerCase().includes(lowerSearch) ||
        (entry.descricao || "").toLowerCase().includes(lowerSearch)
    );
  }, [worker, searchTerm]);

  if (!worker) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] flex flex-col">
        <DialogHeader className="relative">
          <div className="flex justify-between items-start pr-8">
            <div>
              <DialogTitle>Todos os Lançamentos</DialogTitle>
              <DialogDescription>
                Visualizando todos os lançamentos de {worker.nome} ({worker.matricula}) para o ano processado.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => {
                if (!worker) return;

                let text = `TRABALHADOR: ${worker.nome} (${worker.matricula})\n`;
                text += `FILTRO ATUAL: ${searchTerm || "Nenhum"}\n\n`;
                text += `Origem\tCódigo\tDescrição\tValor\n`;

                filteredEntries.forEach((entry) => {
                  text += `${entry.origem}\t${entry.codigo || "-"}\t${
                    entry.descricao || "-"
                  }\tR$ ${entry.valor.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}\n`;
                });

                text += `\nTOTAL FILTRADO: R$ ${filteredEntries
                  .reduce((acc, curr) => acc + curr.valor, 0)
                  .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

                navigator.clipboard.writeText(text);
                toast.success("Dados copiados para a área de transferência");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
          </div>
        </DialogHeader>

        <div className="relative my-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Filtrar por código, descrição ou origem..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-auto rounded-md border text-[12px]">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[180px]">Origem</TableHead>
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right w-[150px]">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50">
                    <TableCell className="font-medium py-3">{entry.origem}</TableCell>
                    <TableCell className="font-mono py-3">{entry.codigo || "-"}</TableCell>
                    <TableCell className="py-3">{entry.descricao || "-"}</TableCell>
                    <TableCell className="text-right font-mono py-3">
                      {entry.valor.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Nenhum lançamento encontrado para o filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex justify-between items-center text-xs text-slate-500 bg-slate-50 p-2 rounded">
          <div className="flex items-center gap-1.5">
            <ListFilter className="h-3.5 w-3.5" />
            <span>Mostrando {filteredEntries.length} de {worker.allEntries.length} lançamentos</span>
          </div>
          <div className="font-bold">
            Total: R$ {filteredEntries.reduce((acc, curr) => acc + curr.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
