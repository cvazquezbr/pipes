import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AggregatedWorkerData } from "@/lib/rendimentosExport";
import { parseValue } from "@/lib/rendimentosExport";

interface WorkerGozosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker: AggregatedWorkerData | null;
}

export function WorkerGozosDialog({
  open,
  onOpenChange,
  worker,
}: WorkerGozosDialogProps) {
  if (!worker) return null;

  const totalIrByYear = worker.gozos.reduce((acc, gozo) => {
    if (gozo.irRateado) {
      Object.entries(gozo.irRateado).forEach(([monthYear, value]) => {
        const year = monthYear.split("-")[0];
        const val = parseValue(value);
        acc[year] = (acc[year] || 0) + val;
      });
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Períodos de Gozo</DialogTitle>
          <DialogDescription>
            Listagem de períodos de gozo de {worker.nome} ({worker.matricula}) com início no ano processado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-md border text-[12px] mt-4">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              <TableRow>
                <TableHead>Início</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Proventos</TableHead>
                <TableHead className="text-right">Descontos</TableHead>
                <TableHead>Simplificado</TableHead>
                <TableHead className="text-right">Dias</TableHead>
                <TableHead className="text-right">Dias Abono</TableHead>
                <TableHead className="text-right">Dep.</TableHead>
                <TableHead>IR Rateado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {worker.gozos.length > 0 ? (
                worker.gozos.map((gozo, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50">
                    <TableCell className="py-3">{gozo.Inicio || "-"}</TableCell>
                    <TableCell className="py-3">{gozo.Pagamento || "-"}</TableCell>
                    <TableCell className="text-right py-3 font-mono">
                      {parseValue(gozo.proventos).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right py-3 font-mono">
                      {parseValue(gozo.descontos || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-3">{gozo.simplificado ? "Sim" : "Não"}</TableCell>
                    <TableCell className="text-right py-3">{gozo.dias || 0}</TableCell>
                    <TableCell className="text-right py-3">{gozo.diasAbono || 0}</TableCell>
                    <TableCell className="text-right py-3">{gozo.numeroDependentes || 0}</TableCell>
                    <TableCell className="py-3 min-w-[120px]">
                      <div className="text-[10px] space-y-1">
                        {gozo.irRateado && Object.entries(gozo.irRateado).map(([my, val]) => (
                          <div key={my} className="flex justify-between gap-2">
                            <span>{my}:</span>
                            <span className="font-mono">
                              {parseValue(val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                        {!gozo.irRateado && "-"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Nenhum período de gozo encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {Object.keys(totalIrByYear).length > 0 && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Total IR Rateado por Ano</h4>
            <div className="flex flex-wrap gap-4">
              {Object.entries(totalIrByYear).sort().map(([year, total]) => (
                <div key={year} className="bg-white p-2 rounded border shadow-sm flex flex-col min-w-[100px]">
                  <span className="text-[10px] text-slate-500">{year}</span>
                  <span className="text-sm font-bold font-mono">
                    R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
