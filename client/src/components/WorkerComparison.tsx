import { useState, useCallback } from "react";
import { JsonUpload } from "./JsonUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { compareWorkers, ComparisonReport, WorkerChange } from "@/lib/workerComparison";
import { Users, ArrowRight, Check, History, UserPlus, UserMinus, AlertCircle } from "lucide-react";

export function WorkerComparison() {
  const [oldData, setOldData] = useState<any[] | null>(null);
  const [newData, setNewData] = useState<any[] | null>(null);
  const [report, setReport] = useState<ComparisonReport | null>(null);

  const handleProcess = useCallback(() => {
    if (oldData && newData) {
      const result = compareWorkers(oldData, newData);
      setReport(result);
    }
  }, [oldData, newData]);

  const handleClearOld = useCallback(() => {
    setOldData(null);
    setReport(null);
  }, []);

  const handleClearNew = useCallback(() => {
    setNewData(null);
    setReport(null);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Versão Anterior</h3>
          <JsonUpload
            onFileLoaded={(data) => setOldData(Array.isArray(data) ? data : [data])}
            title="Versão Antiga"
            description="Carregue o JSON da versão anterior do cadastro"
            onClear={handleClearOld}
          />
          {oldData && (
            <div className="flex items-center gap-2 text-xs text-green-600 font-medium px-2">
              <Check className="h-3 w-3" /> {oldData.length} trabalhadores carregados
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Versão Atual</h3>
          <JsonUpload
            onFileLoaded={(data) => setNewData(Array.isArray(data) ? data : [data])}
            title="Versão Nova"
            description="Carregue o JSON com as alterações recentes"
            onClear={handleClearNew}
          />
          {newData && (
            <div className="flex items-center gap-2 text-xs text-green-600 font-medium px-2">
              <Check className="h-3 w-3" /> {newData.length} trabalhadores carregados
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleProcess}
          disabled={!oldData || !newData}
          className="min-w-[200px]"
        >
          <History className="mr-2 h-4 w-4" />
          Comparar Cadastros
        </Button>
      </div>

      {report && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <Separator />

          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-blue-50/50 border-blue-100">
              <CardContent className="pt-6 text-center">
                <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-900">{report.added}</div>
                <div className="text-xs text-blue-600 font-medium uppercase tracking-wider">Adicionados</div>
              </CardContent>
            </Card>

            <Card className="bg-amber-50/50 border-amber-100">
              <CardContent className="pt-6 text-center">
                <div className="bg-amber-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-amber-900">{report.modified}</div>
                <div className="text-xs text-amber-600 font-medium uppercase tracking-wider">Modificados</div>
              </CardContent>
            </Card>

            <Card className="bg-red-50/50 border-red-100">
              <CardContent className="pt-6 text-center">
                <div className="bg-red-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <UserMinus className="h-5 w-5 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-red-900">{report.removed}</div>
                <div className="text-xs text-red-600 font-medium uppercase tracking-wider">Removidos</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
             <h4 className="text-lg font-bold text-slate-900">Detalhamento das Alterações</h4>

             {report.changes.length === 0 ? (
               <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed">
                 <p className="text-slate-500">Nenhuma alteração detectada entre as versões.</p>
               </div>
             ) : (
               <div className="grid gap-4">
                 {report.changes.map((change, idx) => (
                   <Card key={idx} className="overflow-hidden border-slate-200">
                     <CardHeader className="py-3 px-4 bg-slate-50/50 flex flex-row items-center justify-between space-y-0">
                       <div className="flex items-center gap-3">
                         <div className={`p-1.5 rounded-md ${
                           change.type === 'added' ? 'bg-blue-100 text-blue-600' :
                           change.type === 'removed' ? 'bg-red-100 text-red-600' :
                           'bg-amber-100 text-amber-600'
                         }`}>
                           {change.type === 'added' ? <UserPlus className="h-4 w-4" /> :
                            change.type === 'removed' ? <UserMinus className="h-4 w-4" /> :
                            <AlertCircle className="h-4 w-4" />}
                         </div>
                         <div>
                           <div className="text-sm font-bold text-slate-900">{change.nome}</div>
                           <div className="text-[10px] text-slate-500 font-mono">Matrícula: {change.matricula}</div>
                         </div>
                       </div>
                       <Badge variant={
                         change.type === 'added' ? 'default' :
                         change.type === 'removed' ? 'destructive' :
                         'outline'
                       } className={change.type === 'modified' ? 'border-amber-200 bg-amber-50 text-amber-700' : ''}>
                         {change.type === 'added' ? 'Novo' :
                          change.type === 'removed' ? 'Removido' :
                          'Alterado'}
                       </Badge>
                     </CardHeader>
                     {change.fieldChanges && change.fieldChanges.length > 0 && (
                       <CardContent className="py-3 px-4">
                         <div className="grid gap-3">
                           {change.fieldChanges.map((f, fIdx) => (
                             <div key={fIdx} className="text-xs grid grid-cols-[1fr,auto,1fr] items-center gap-4 bg-slate-50/50 p-2 rounded-lg">
                               <div className="space-y-1">
                                 <div className="text-[10px] text-slate-400 font-bold uppercase">{f.label}</div>
                                 <div className="text-slate-600 line-through opacity-50">{String(f.oldValue)}</div>
                               </div>
                               <ArrowRight className="h-3 w-3 text-slate-400" />
                               <div className="space-y-1">
                                 <div className="text-[10px] text-transparent font-bold uppercase">.</div>
                                 <div className="text-slate-900 font-bold">{String(f.newValue)}</div>
                               </div>
                             </div>
                           ))}
                         </div>
                       </CardContent>
                     )}
                   </Card>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
