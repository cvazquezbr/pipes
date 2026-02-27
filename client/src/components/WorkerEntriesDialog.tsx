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
import { Search, ListFilter } from "lucide-react";
import type { AggregatedWorkerData } from "@/lib/rendimentosExport";

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
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Todos os Lançamentos</DialogTitle>
          <DialogDescription>
            Visualizando todos os lançamentos de {worker.nome} ({worker.matricula}) para o ano processado.
          </DialogDescription>
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

        <div className="flex-1 overflow-auto rounded-md border text-[11px]">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[150px]">Origem</TableHead>
                <TableHead className="w-[100px]">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right w-[120px]">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50">
                    <TableCell className="font-medium">{entry.origem}</TableCell>
                    <TableCell className="font-mono">{entry.codigo || "-"}</TableCell>
                    <TableCell>{entry.descricao || "-"}</TableCell>
                    <TableCell className="text-right font-mono">
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
