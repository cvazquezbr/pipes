/**
 * Página principal - Processador de Notas Fiscais (NFS-e)
 * Orquestra upload de Excel, processamento de PDFs e exportação de resultados
 *
 * Design: Minimalista e funcional com foco em usabilidade
 * - Layout em duas colunas (inputs à esquerda, resultados à direita)
 * - Tipografia clara com hierarquia bem definida
 * - Cores neutras com destaque em azul para ações
 */

import { useCallback, useState } from 'react';
import { ExcelUpload } from '@/components/ExcelUpload';
import { PDFUpload } from '@/components/PDFUpload';
import { ResultsTable } from '@/components/ResultsTable';
import { useInvoiceProcessor } from '@/hooks/useInvoiceProcessor';
import { exportToCSV, exportToJSON, exportToExcel, downloadFile } from '@/lib/excelUtils';
import { exportToZOHOExcel, generateZOHOValidationReport } from '@/lib/zohoExport';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, LayoutList, Loader2, X } from 'lucide-react';
import type { ExtractedInvoice } from '@/lib/types';

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isVerResultadosLoading, setIsVerResultadosLoading] = useState(false);

  const {
    invoices,
    referenceData,
    allSheets,
    isProcessing,
    progress,
    error,
    loadExcelReference,
    processPDFsParallel,
    addInvoices,
    updateInvoice,
    removeInvoice,
    clearAll,
  } = useInvoiceProcessor();

  const handleExcelLoaded = useCallback(
    async (sheets: Record<string, Record<string, unknown>[]>, file: File) => {
      try {
        await loadExcelReference(file);
        const firstSheetName = Object.keys(sheets)[0];
        const recordCount = sheets[firstSheetName]?.length || 0;
        toast.success(`Planilha carregada com ${recordCount} registros`);
      } catch (err) {
        // Erro já é tratado no hook e exibido no UI
      }
    },
    [loadExcelReference]
  );

  const handlePDFsProcessed = useCallback(
    async (results: ExtractedInvoice[]) => {
      console.log('[Home] handlePDFsProcessed chamado com ' + results.length + ' resultado(s)');
      const successCount = results.filter((r) => !r.extractionErrors?.length).length;
      console.log('[Home] ' + successCount + ' com sucesso, ' + (results.length - successCount) + ' com erros');
      toast.success(`${successCount}/${results.length} notas fiscais processadas com sucesso`);
    },
    []
  );

  const handleExport = useCallback(
    (format: 'csv' | 'json' | 'xlsx' | 'zoho-excel') => {
      try {
        if (format === 'csv') {
          const csv = exportToCSV(invoices);
          downloadFile(csv, `notas-fiscais-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
          toast.success('Exportado para CSV');
        } else if (format === 'json') {
          const json = exportToJSON(invoices);
          downloadFile(json, `notas-fiscais-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
          toast.success('Exportado para JSON');
        } else if (format === 'xlsx') {
          exportToExcel(invoices);
          toast.success('Exportado para Excel');
        } else if (format === 'zoho-excel') {
          const report = generateZOHOValidationReport(invoices);
          if (report.invalidInvoices > 0) {
            toast.warning(`${report.invalidInvoices} nota(s) com problemas`);
          }
          exportToZOHOExcel(invoices, referenceData, allSheets);
          toast.success(`ZOHO: ${report.validInvoices}/${report.totalInvoices} válidas`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao exportar';
        toast.error(errorMessage);
      }
    },
    [invoices]
  );

  const handleClearAll = useCallback(() => {
    clearAll();
    setCurrentStep(1);
    toast.success('Todos os dados foram limpos');
  }, [clearAll]);

  const steps = [
    { id: 1, name: 'Planilha de Referência', icon: FileSpreadsheet },
    { id: 2, name: 'Arquivos PDF', icon: FileText },
    { id: 3, name: 'Resultados e Exportação', icon: LayoutList },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-100 flex flex-col items-center max-w-xs w-full">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">Processando</h3>
            <p className="text-sm text-slate-500 mb-6 text-center">
              Extraindo dados das notas fiscais...
            </p>

            {progress > 0 && (
              <div className="w-full space-y-2">
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progresso</p>
                  <p className="text-[10px] font-bold text-primary">{Math.round(progress)}%</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">Processador NFS-e</h1>
                <p className="text-xs text-slate-500 font-medium">Extração Inteligente de Dados</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {invoices.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={isProcessing}
                  className="text-slate-500 hover:text-destructive"
                >
                  Limpar Tudo
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Stepper */}
        <nav aria-label="Progress" className="mb-12">
          <ol role="list" className="flex items-center justify-center space-x-4 md:space-x-12">
            {steps.map((step, stepIdx) => (
              <li key={step.name} className="flex items-center">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`
                      flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300
                      ${
                        currentStep > step.id
                          ? 'bg-primary border-primary text-primary-foreground'
                          : currentStep === step.id
                          ? 'border-primary text-primary ring-4 ring-primary/10'
                          : 'border-slate-200 text-slate-400'
                      }
                    `}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={`
                      text-[10px] md:text-xs font-bold uppercase tracking-wider
                      ${currentStep >= step.id ? 'text-slate-900' : 'text-slate-400'}
                    `}
                  >
                    {step.name}
                  </span>
                </div>
                {stepIdx !== steps.length - 1 && (
                  <div
                    className={`hidden md:block h-0.5 w-12 lg:w-20 ml-4 md:ml-12 rounded-full transition-colors duration-500 ${
                      currentStep > step.id ? 'bg-primary' : 'bg-slate-200'
                    }`}
                  />
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-8">
          {/* Step 1: Excel Upload */}
          {currentStep === 1 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ExcelUpload onFileLoaded={handleExcelLoaded} isLoading={isProcessing} />

              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setCurrentStep(2)}
                  disabled={isProcessing}
                  size="lg"
                  className="min-w-[140px]"
                >
                  Próximo Passo
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: PDF Upload */}
          {currentStep === 2 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <PDFUpload
                onProcess={async (files) => {
                  try {
                    const results = await processPDFsParallel(files);
                    handlePDFsProcessed(results);
                    // Opcionalmente avançar para o próximo passo após carregar
                    // Se houver notas com sucesso, vamos para o próximo passo automaticamente
                    if (results.some(r => !r.extractionErrors?.length)) {
                      setCurrentStep(3);
                    }
                    return results;
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Erro ao processar PDFs';
                    toast.error(errorMessage);
                    throw err;
                  }
                }}
                onProcessComplete={() => {}} // Agora usamos onProcess
                isProcessing={isProcessing}
                progress={progress}
              />

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  disabled={isProcessing || isVerResultadosLoading}
                  size="lg"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>

                {invoices.length > 0 && (
                  <Button
                    onClick={() => {
                      setIsVerResultadosLoading(true);
                      // Simular um breve processamento/transição para feedback visual
                      setTimeout(() => {
                        setCurrentStep(3);
                        setIsVerResultadosLoading(false);
                      }, 500);
                    }}
                    disabled={isProcessing || isVerResultadosLoading}
                    size="lg"
                    className="min-w-[140px]"
                  >
                    {isVerResultadosLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        Ver Resultados
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                  disabled={isProcessing}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Adicionar mais Notas
                </Button>

                <div className="flex gap-2">
                   {invoices.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      disabled={isProcessing}
                      className="md:hidden text-slate-500"
                    >
                      Limpar Tudo
                    </Button>
                  )}
                </div>
              </div>

              <ResultsTable
                invoices={invoices}
                onInvoiceUpdate={updateInvoice}
                onInvoiceDelete={removeInvoice}
                onExport={handleExport}
                isLoading={isProcessing}
              />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="max-w-2xl mx-auto mt-6 rounded-lg bg-destructive/10 border border-destructive/20 p-4 animate-in shake duration-500">
              <div className="flex items-center gap-3">
                <div className="bg-destructive text-white p-1 rounded-full">
                  <X className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-destructive">Ocorreu um erro</p>
                  <p className="text-sm text-destructive/80 font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="container mx-auto px-4 py-6">
          <p className="text-xs text-slate-600 text-center">
            Processador de Notas Fiscais • Extração automática de dados de PDFs DANFSe
          </p>
        </div>
      </footer>
    </div>
  );
}
