import { useState } from "react";
import { ExcelUpload } from "@/components/ExcelUpload";
import { PDFUpload } from "@/components/PDFUpload";
import { SMTPConfigForm } from "@/components/SMTPConfigForm";
import { FolhaPontoDashboard } from "@/components/FolhaPontoDashboard";
import {
  parseWorkersExcel,
  processFolhaPonto,
  type WorkerData,
  type FolhaPontoResult
} from "@/lib/folhaPonto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  LayoutList,
  Mail,
  Loader2,
  Clock
} from "lucide-react";
import { toast } from "sonner";

interface FolhaPontoWorkflowProps {
  onBackToMenu: () => void;
}

export function FolhaPontoWorkflow({ onBackToMenu }: FolhaPontoWorkflowProps) {
  const [step, setStep] = useState(1);
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [results, setResults] = useState<FolhaPontoResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [horasAdicionaisLimite, setHorasAdicionaisLimite] = useState(2);

  const handleExcelLoaded = async (data: any, file: File) => {
    try {
      const parsedWorkers = await parseWorkersExcel(file);
      setWorkers(parsedWorkers);
      toast.success(`${parsedWorkers.length} funcionários carregados da planilha.`);
      setStep(2);
    } catch (e) {
      toast.error("Erro ao ler a planilha de trabalhadores.");
      console.error(e);
    }
  };

  const handlePDFProcessed = async (files: File[]) => {
     if (files.length === 0) return [];

     setIsProcessing(true);
     setProgress(0);
     try {
       const pdfFile = files[0];
       const results = await processFolhaPonto(pdfFile, workers, { horasAdicionaisLimite }, (p) => setProgress(p));
       setResults(results);
       toast.success("Processamento concluído!");
       setStep(4);
       return []; // PDFUpload espera retorno de ExtractedInvoice[] mas aqui usamos FolhaPontoResult[]
     } catch (e: any) {
       toast.error("Erro ao processar PDF: " + e.message);
       console.error(e);
       throw e;
     } finally {
       setIsProcessing(false);
     }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header local */}
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" onClick={onBackToMenu} className="-ml-2">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar ao Início
        </Button>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
           Passo {step} de 4
        </div>
      </div>

      {/* Stepper horizontal local */}
      <nav aria-label="Progress" className="mb-8">
        <ol role="list" className="flex items-center justify-center space-x-12">
          {[
            { id: 1, name: "Planilha", icon: FileSpreadsheet },
            { id: 2, name: "Configurações", icon: Clock },
            { id: 3, name: "PDF Pontos", icon: FileText },
            { id: 4, name: "Resultados", icon: LayoutList },
          ].map((s) => (
            <li key={s.id} className="flex flex-col items-center gap-2">
              <div className={`
                flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300
                ${step > s.id ? "bg-primary border-primary text-primary-foreground" : step === s.id ? "border-primary text-primary ring-4 ring-primary/10" : "border-slate-200 text-slate-400"}
              `}>
                <s.icon className="h-5 w-5" />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${step >= s.id ? "text-slate-900" : "text-slate-400"}`}>
                {s.name}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {/* Steps Content */}
      <div className="min-h-[400px]">
        {step === 1 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <ExcelUpload
              onFileLoaded={handleExcelLoaded}
              isLoading={false}
              title="Upload da Base de Funcionários"
              description="Anexe a planilha Excel contendo CPF, Nome e E-mail"
            />
          </div>
        )}

        {step === 2 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Regras de Negócio
                  </CardTitle>
                  <CardDescription>Configure os limites para as críticas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Limite de Horas Adicionais</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        value={horasAdicionaisLimite}
                        onChange={e => setHorasAdicionaisLimite(Number(e.target.value))}
                        className="w-24"
                      />
                      <span className="text-sm text-slate-500">horas por dia</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <SMTPConfigForm />
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={() => setStep(3)} size="lg" className="min-w-[140px]">
                Próximo Passo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <PDFUpload
              onProcess={handlePDFProcessed}
              isProcessing={isProcessing}
              progress={progress}
              title="Upload do Espelho de Ponto"
              description="Anexe o arquivo PDF contendo todas as folhas de ponto"
            />
            <div className="flex justify-start">
               <Button variant="outline" onClick={() => setStep(2)}>
                 <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
               </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <FolhaPontoDashboard
            results={results}
            onClear={() => {
              setResults([]);
              setWorkers([]);
              setStep(1);
            }}
          />
        )}
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="bg-white p-8 rounded-xl shadow-xl border border-slate-100 flex flex-col items-center max-w-sm w-full">
              <div className="text-4xl font-black text-primary mb-2">{progress}%</div>
              <h3 className="text-lg font-bold mb-4">Processando Pontos...</h3>
              <Progress value={progress} className="w-full" />
           </div>
        </div>
      )}
    </div>
  );
}
