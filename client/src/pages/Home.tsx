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
import { exportPisCofinsIssExcel, processPisCofinsIssData } from '@/lib/pisCofinsIssExport';
import { exportIrpjCsllExcel, processIrpjCsllData } from '@/lib/irpjCsllExport';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, LayoutList, Loader2, X, Receipt, Coins, TrendingUp } from 'lucide-react';
import type { ExtractedInvoice } from '@/lib/types';

export default function Home() {
  const [workflow, setWorkflow] = useState<'nfse' | 'piscofinsiss' | 'irpjcsll' | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isVerResultadosLoading, setIsVerResultadosLoading] = useState(false);
  const [resultadoAplicacao, setResultadoAplicacao] = useState<string>('');
  const [retencaoAplicacao, setRetencaoAplicacao] = useState<string>('');

  const {
    invoices,
    referenceData,
    allSheets,
    invoiceSheetData,
    billSheetData,
    isProcessing,
    progress,
    error,
    loadExcelReference,
    loadInvoiceSheet,
    loadBillSheet,
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
    setWorkflow(null);
    setResultadoAplicacao('');
    setRetencaoAplicacao('');
    toast.success('Todos os dados foram limpos');
  }, [clearAll]);

  // Processar dados para visualização no passo 4
  let processedData: any[] = [];
  let irpjCsllResumo: any = null;

  if (currentStep === 4) {
    if (workflow === 'piscofinsiss') {
      processedData = processPisCofinsIssData(invoiceSheetData, billSheetData, allSheets).faturasFinais;
    } else if (workflow === 'irpjcsll') {
      const result = processIrpjCsllData(
        invoiceSheetData,
        allSheets,
        parseFloat(resultadoAplicacao.replace(',', '.')) || 0,
        parseFloat(retencaoAplicacao.replace(',', '.')) || 0
      );
      processedData = result.faturasFinais;
      irpjCsllResumo = result.resumo;
    }
  }

  // Cálculos de totais para o fluxo PIS/COFINS/ISS
  const taxTotals = (processedData as any[]).reduce((acc, f) => ({
    irpjDevido: acc.irpjDevido + (f['IRPJ.devido'] || 0),
    irpjRetido: acc.irpjRetido + (f['IRPJ.retido'] || 0),
    irpjPendente: acc.irpjPendente + (f['IRPJ.pendente'] || 0),
    csllDevido: acc.csllDevido + (f['CSLL.devido'] || 0),
    csllRetido: acc.csllRetido + (f['CSLL.retido'] || 0),
    csllPendente: acc.csllPendente + (f['CSLL.pendente'] || 0),
    cofinsDevido: acc.cofinsDevido + (f['COFINS.devido'] || 0),
    cofinsRetido: acc.cofinsRetido + (f['COFINS.retido'] || 0),
    cofinsPendente: acc.cofinsPendente + (f['COFINS.pendente'] || 0),
    pisDevido: acc.pisDevido + (f['PIS.devido'] || 0),
    pisRetido: acc.pisRetido + (f['PIS.retido'] || 0),
    pisPendente: acc.pisPendente + (f['PIS.pendente'] || 0),
    issDevido: acc.issDevido + (f['ISS.devido'] || 0),
    issRetido: acc.issRetido + (f['ISS.retido'] || 0),
    issAntecipado: acc.issAntecipado + (f['ISS.antecipado'] || 0),
    issPendente: acc.issPendente + (f['ISS.pendente'] || 0),
    totalFaturado: acc.totalFaturado + (f.Total || 0),
  }), {
    irpjDevido: 0, irpjRetido: 0, irpjPendente: 0,
    csllDevido: 0, csllRetido: 0, csllPendente: 0,
    cofinsDevido: 0, cofinsRetido: 0, cofinsPendente: 0,
    pisDevido: 0, pisRetido: 0, pisPendente: 0,
    issDevido: 0, issRetido: 0, issAntecipado: 0, issPendente: 0,
    totalFaturado: 0
  });

  const steps = workflow === 'piscofinsiss'
    ? [
        { id: 1, name: 'Planilha de Referência', icon: FileSpreadsheet },
        { id: 2, name: 'Planilha de Faturas', icon: FileSpreadsheet },
        { id: 3, name: 'Planilha de Cobranças', icon: FileSpreadsheet },
        { id: 4, name: 'Resultados e Exportação', icon: LayoutList },
      ]
    : workflow === 'irpjcsll'
    ? [
        { id: 1, name: 'Planilha de Referência', icon: FileSpreadsheet },
        { id: 2, name: 'Planilha de Faturas', icon: FileSpreadsheet },
        { id: 3, name: 'Valores de Aplicação', icon: TrendingUp },
        { id: 4, name: 'Resultados e Exportação', icon: LayoutList },
      ]
    : [
        { id: 1, name: 'Planilha de Referência', icon: FileSpreadsheet },
        { id: 2, name: 'Arquivos PDF', icon: FileText },
        { id: 3, name: 'Resultados e Exportação', icon: LayoutList },
      ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-10 rounded-2xl shadow-2xl border border-slate-100 flex flex-col items-center max-w-sm w-full">
            <div className="relative mb-6 flex items-center justify-center">
              <div className="text-5xl font-black text-primary tabular-nums">
                {Math.round(progress)}%
              </div>
              <Loader2 className="absolute -top-6 -right-6 h-8 w-8 text-primary/20 animate-spin" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-2">Processando Notas</h3>
            <p className="text-sm text-slate-500 mb-8 text-center px-4">
              Extraindo dados dos arquivos PDF de forma inteligente.
            </p>

            <div className="w-full space-y-3">
              <Progress value={progress} className="h-3 shadow-inner" />
              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status do Processamento</p>
                <p className="text-[10px] font-bold text-primary uppercase">{Math.round(progress)}% Concluído</p>
              </div>
            </div>
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
              {(invoices.length > 0 || invoiceSheetData.length > 0 || billSheetData.length > 0) && (
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
        {/* Workflow Selection */}
        {!workflow && !isProcessing && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-slate-900">Escolha o fluxo de trabalho</h2>
              <p className="text-slate-500">Selecione uma das opções abaixo para começar o processamento.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card
                className="group hover:border-primary/50 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md overflow-hidden"
                onClick={() => setWorkflow('nfse')}
              >
                <div className="h-2 bg-primary/20 group-hover:bg-primary/40 transition-colors" />
                <CardHeader>
                  <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FileText className="text-primary h-6 w-6" />
                  </div>
                  <CardTitle>Exportação ZOHO (PDFs)</CardTitle>
                  <CardDescription>
                    Processar notas fiscais em PDF e exportar para o formato de carga do ZOHO.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Planilha de referência</li>
                    <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Upload de PDFs NFS-e</li>
                    <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Geração de planilha ZOHO</li>
                  </ul>
                </CardContent>
              </Card>

              <Card
                className="group hover:border-primary/50 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md overflow-hidden"
                onClick={() => setWorkflow('piscofinsiss')}
              >
                <div className="h-2 bg-primary/20 group-hover:bg-primary/40 transition-colors" />
                <CardHeader>
                  <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Coins className="text-primary h-6 w-6" />
                  </div>
                  <CardTitle>COFINS/PIS e ISS</CardTitle>
                  <CardDescription>
                    Gerar relatório de impostos a partir de planilhas de faturamento e cobrança.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Planilha de referência</li>
                    <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Planilha de faturas</li>
                    <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Planilha de cobranças</li>
                  </ul>
                </CardContent>
              </Card>

              <Card
                className="group hover:border-primary/50 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md overflow-hidden"
                onClick={() => setWorkflow('irpjcsll')}
              >
                <div className="h-2 bg-primary/20 group-hover:bg-primary/40 transition-colors" />
                <CardHeader>
                  <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <TrendingUp className="text-primary h-6 w-6" />
                  </div>
                  <CardTitle>IRPJ e CSLL Trimestral</CardTitle>
                  <CardDescription>
                    Gerar relatório de IRPJ e CSLL com base em faturamento e resultados de aplicação.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Planilha de referência</li>
                    <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Planilha de faturas</li>
                    <li className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500" /> Valores de aplicação</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Stepper */}
        {workflow && (
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
        )}

        {workflow && (
        <div className="space-y-8">
          {/* Step 1: Excel Upload (Reference) */}
          {currentStep === 1 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="sm" onClick={() => setWorkflow(null)} className="-ml-2">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Trocar fluxo
                </Button>
              </div>
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

          {/* Step 2: NFSe -> PDF Upload / PISCOFINSISS -> Invoice Excel */}
          {currentStep === 2 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {workflow === 'nfse' ? (
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
              ) : (
                <div className="space-y-6">
                  <ExcelUpload
                    onFileLoaded={(_, file) => loadInvoiceSheet(file)}
                    isLoading={isProcessing}
                    title="Planilha de Faturas"
                    description="Carregue o arquivo de faturamento (ex: Fatura 01-2026)"
                  />
                </div>
              )}

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

                {(workflow === 'nfse' ? invoices.length > 0 : invoiceSheetData.length > 0) && (
                  <Button
                    onClick={() => {
                      setIsVerResultadosLoading(true);
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
                        {workflow === 'nfse' ? 'Ver Resultados' : 'Próximo Passo'}
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: NFSe -> Results / PISCOFINSISS -> Bill Excel / IRPJCSLL -> Application Values */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-500">
              {workflow === 'nfse' ? (
                <div className="space-y-6">
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
                  </div>

                  <ResultsTable
                    invoices={invoices}
                    onInvoiceUpdate={updateInvoice}
                    onInvoiceDelete={removeInvoice}
                    onExport={handleExport}
                    isLoading={isProcessing}
                  />
                </div>
              ) : workflow === 'piscofinsiss' ? (
                <div className="max-w-2xl mx-auto space-y-6">
                  <ExcelUpload
                    onFileLoaded={(_, file) => loadBillSheet(file)}
                    isLoading={isProcessing}
                    title="Planilha de Cobranças"
                    description="Carregue o arquivo de cobranças (ex: Cobrança 01-2026)"
                    rowFilter={(row) => {
                      const billNumberKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'bill number') || 'Bill Number';
                      return String(row[billNumberKey] || '').toUpperCase().includes(' ISS');
                    }}
                  />

                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      disabled={isProcessing}
                      size="lg"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Voltar
                    </Button>

                    <Button
                      onClick={() => setCurrentStep(4)}
                      disabled={isProcessing}
                      size="lg"
                      className="min-w-[140px]"
                    >
                      {billSheetData.length > 0 ? 'Ver Resultados' : 'Ver Resultados / Pular'}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="max-w-md mx-auto space-y-8 py-8">
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold">Valores de Aplicação</h3>
                    <p className="text-sm text-slate-500">Informe os valores para compor a base de cálculo do trimestre.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="resultado">Resultado da Aplicação (R$)</Label>
                      <Input
                        id="resultado"
                        placeholder="Ex: 3560.10"
                        value={resultadoAplicacao}
                        onChange={(e) => setResultadoAplicacao(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="retencao">Retenção da Aplicação (R$)</Label>
                      <Input
                        id="retencao"
                        placeholder="Ex: 874.21"
                        value={retencaoAplicacao}
                        onChange={(e) => setRetencaoAplicacao(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      disabled={isProcessing}
                      size="lg"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Voltar
                    </Button>

                    <Button
                      onClick={() => setCurrentStep(4)}
                      disabled={isProcessing}
                      size="lg"
                      className="min-w-[140px]"
                    >
                      Ver Resultados
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Results & Export */}
          {currentStep === 4 && (workflow === 'piscofinsiss' || workflow === 'irpjcsll') && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(3)}
                  disabled={isProcessing}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>

                {workflow === 'piscofinsiss' ? (
                <Button
                  onClick={() => exportPisCofinsIssExcel(invoiceSheetData, billSheetData, allSheets)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Exportar PIS/COFINS e ISS
                </Button>
                ) : (
                  <Button
                    onClick={() => exportIrpjCsllExcel(
                      invoiceSheetData,
                      allSheets,
                      parseFloat(resultadoAplicacao.replace(',', '.')) || 0,
                      parseFloat(retencaoAplicacao.replace(',', '.')) || 0
                    )}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar IRPJ e CSLL
                  </Button>
                )}
              </div>

              {workflow === 'piscofinsiss' ? (
              <Card className="bg-slate-50/50 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    Resumo Consolidado de Impostos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 border-b">
                          <th className="text-left py-2 font-medium">Imposto</th>
                          <th className="text-right py-2 font-medium">Devido</th>
                          <th className="text-right py-2 font-medium">Retido</th>
                          <th className="text-right py-2 font-medium">Antecipado</th>
                          <th className="text-right py-2 font-medium text-primary">Pendente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr className="bg-slate-50/50">
                          <td className="py-2 font-bold text-xs">TOTAL FATURADO</td>
                          <td className="text-right py-2 text-xs font-bold" colSpan={4}>
                            {taxTotals.totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 font-medium text-xs">COFINS</td>
                          <td className="text-right py-2 text-xs">{taxTotals.cofinsDevido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right py-2 text-xs">{taxTotals.cofinsRetido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right py-2 text-xs text-slate-300">-</td>
                          <td className="text-right py-2 text-xs font-semibold">{taxTotals.cofinsPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-medium text-xs">PIS</td>
                          <td className="text-right py-2 text-xs">{taxTotals.pisDevido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right py-2 text-xs">{taxTotals.pisRetido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right py-2 text-xs text-slate-300">-</td>
                          <td className="text-right py-2 text-xs font-semibold">{taxTotals.pisPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-medium text-xs">ISS</td>
                          <td className="text-right py-2 text-xs">{taxTotals.issDevido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right py-2 text-xs">{taxTotals.issRetido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right py-2 text-xs">{taxTotals.issAntecipado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="text-right py-2 text-xs font-semibold">{taxTotals.issPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-bold bg-slate-100/50">
                          <td className="py-2 text-xs">TOTAL</td>
                          <td className="text-right py-2 text-xs">
                            {(taxTotals.cofinsDevido + taxTotals.pisDevido + taxTotals.issDevido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right py-2 text-xs">
                            {(taxTotals.cofinsRetido + taxTotals.pisRetido + taxTotals.issRetido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right py-2 text-xs">
                            {taxTotals.issAntecipado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right py-2 text-xs text-primary">
                            {(taxTotals.cofinsPendente + taxTotals.pisPendente + taxTotals.issPendente).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
              ) : irpjCsllResumo && (
                <Card className="bg-slate-50/50 border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-primary" />
                      Resumo Consolidado IRPJ e CSLL
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">Base de Cálculo</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Total Faturado:</span>
                            <span className="font-mono">R$ {irpjCsllResumo.totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Presunção de Lucro (32%):</span>
                            <span className="font-mono">R$ {irpjCsllResumo.presuncaoLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between font-bold border-t pt-1">
                            <span>Base de Cálculo:</span>
                            <span className="font-mono">R$ {irpjCsllResumo.baseCalculo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        <div className="bg-primary/5 p-3 rounded-lg space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Resultado da Aplicação:</span>
                            <span className="font-bold">R$ {irpjCsllResumo.resultadoAplicacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-blue-600">
                            <span>Retenção da Aplicação:</span>
                            <span className="font-bold">R$ {irpjCsllResumo.retencaoAplicacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">IRPJ</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">IR Devido (15%):</span>
                              <span className="font-mono">R$ {irpjCsllResumo.irDevido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">IR Adicional (10%):</span>
                              <span className="font-mono">R$ {irpjCsllResumo.irAdicional.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-blue-600">
                              <span className="text-slate-600">IR Retido Total:</span>
                              <span className="font-mono">R$ {irpjCsllResumo.irRetidoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between font-bold text-primary border-t pt-1">
                              <span>Total IRPJ Devido:</span>
                              <span className="font-mono">R$ {irpjCsllResumo.totalIrpjDevido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">CSLL</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">CSLL Devido (9%):</span>
                              <span className="font-mono">R$ {irpjCsllResumo.csllDevidoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-blue-600">
                              <span className="text-slate-600">CSLL Retido Total:</span>
                              <span className="font-mono">R$ {irpjCsllResumo.csllRetidoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between font-bold text-primary border-t pt-1">
                              <span>Total CSLL Devido:</span>
                              <span className="font-mono">R$ {irpjCsllResumo.totalCsllDevido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Faturas Processadas ({processedData.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <div className="max-h-[500px] overflow-auto rounded-md border text-[10px]">
                      <table className="w-full">
                        <thead className="bg-muted sticky top-0 z-10">
                          <tr>
                            <th className="p-1 text-left">Número</th>
                            <th className="p-1 text-left">Data</th>
                            <th className="p-1 text-left">Cliente</th>
                            <th className="p-1 text-left">Esquema Tributação</th>
                            <th className="p-1 text-right">Total</th>
                            <th className="p-1 text-right text-blue-600">IRPJ Ret.</th>
                            <th className="p-1 text-right text-blue-600">CSLL Ret.</th>
                            {workflow === 'piscofinsiss' && (
                              <>
                                <th className="p-1 text-right text-blue-600">COFINS Ret.</th>
                                <th className="p-1 text-right text-blue-600">PIS Ret.</th>
                                <th className="p-1 text-right text-blue-600">ISS Ret.</th>
                              </>
                            )}
                            {workflow === 'irpjcsll' && (
                              <>
                                <th className="p-1 text-right text-primary">IRPJ Contrib.</th>
                                <th className="p-1 text-right text-primary">CSLL Contrib.</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {processedData.map((f, i) => (
                            <tr key={i} className="border-t hover:bg-slate-50">
                              <td className="p-1 font-mono">{String(f.InvoiceNumber || '')}</td>
                              <td className="p-1 whitespace-nowrap">{String(f.InvoiceDateFormatted || '')}</td>
                              <td className="p-1 truncate max-w-[120px]" title={String(f.CustomerName || '')}>{String(f.CustomerName || '')}</td>
                              <td className="p-1 truncate max-w-[150px]" title={String(f.ItemTaxScheme || '')}>
                                <span className={f.ItemTaxScheme === 'Não encontrado' ? 'text-destructive font-bold' : ''}>
                                  {f.ItemTaxScheme}
                                </span>
                              </td>
                              <td className="p-1 text-right font-medium">{(f.Total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-1 text-right text-blue-600">{(f['IRPJ.retido'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-1 text-right text-blue-600">{(f['CSLL.retido'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              {workflow === 'piscofinsiss' && (
                                <>
                                  <td className="p-1 text-right text-blue-600">{(f['COFINS.retido'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-1 text-right text-blue-600">{(f['PIS.retido'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-1 text-right text-blue-600">{(f['ISS.retido'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </>
                              )}
                              {workflow === 'irpjcsll' && (
                                <>
                                  <td className="p-1 text-right text-primary">{(f['contribuicao.IRPJ'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-1 text-right text-primary">{(f['contribuicao.CSLL'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {workflow === 'piscofinsiss' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Cobranças ISS Importadas ({billSheetData.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-60 overflow-auto rounded-md border text-[10px]">
                      <table className="w-full">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="p-1 text-left">Número</th>
                            <th className="p-1 text-left">Data</th>
                            <th className="p-1 text-left">Fornecedor</th>
                            <th className="p-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billSheetData.slice(0, 50).map((row, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-1">{String(row['Bill Number'] || '')}</td>
                              <td className="p-1">{String(row['Bill Date'] || '')}</td>
                              <td className="p-1 truncate max-w-[150px]">{String(row['Vendor Name'] || '')}</td>
                              <td className="p-1 text-right">{String(row['Total'] || '')}</td>
                            </tr>
                          ))}
                          {billSheetData.length > 50 && (
                            <tr><td colSpan={4} className="p-2 text-center text-muted-foreground italic">E mais {billSheetData.length - 50} registros...</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
                )}
              </div>
            </div>
          )}
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
