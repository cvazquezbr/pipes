/**
 * Página principal - Processador de Notas Fiscais (NFS-e)
 * Orquestra upload de Excel, processamento de PDFs e exportação de resultados
 *
 * Design: Minimalista e funcional com foco em usabilidade
 * - Layout em duas colunas (inputs à esquerda, resultados à direita)
 * - Tipografia clara com hierarquia bem definida
 * - Cores neutras com destaque em azul para ações
 */

import { useCallback } from 'react';
import { ExcelUpload } from '@/components/ExcelUpload';
import { PDFUpload } from '@/components/PDFUpload';
import { ResultsTable } from '@/components/ResultsTable';
import { useInvoiceProcessor } from '@/hooks/useInvoiceProcessor';
import { exportToCSV, exportToJSON, exportToExcel, downloadFile } from '@/lib/excelUtils';
import { exportToZOHOExcel, exportToZOHOCSV, generateZOHOValidationReport } from '@/lib/zohoExport';
import { toast } from 'sonner';
import type { ExtractedInvoice } from '@/lib/types';

export default function Home() {
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
    async (data: Record<string, unknown>[]) => {
      await loadExcelReference(new File([JSON.stringify(data)], 'reference.json'));
      toast.success(`Planilha carregada com ${data.length} registros`);
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
    (format: 'csv' | 'json' | 'xlsx' | 'zoho-excel' | 'zoho-csv') => {
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
          exportToZOHOExcel(invoices, referenceData);
          toast.success(`ZOHO: ${report.validInvoices}/${report.totalInvoices} válidas`);
        } else if (format === 'zoho-csv') {
          const report = generateZOHOValidationReport(invoices);
          if (report.invalidInvoices > 0) {
            toast.warning(`${report.invalidInvoices} nota(s) com problemas`);
          }
          const csv = exportToZOHOCSV(invoices, referenceData);
          downloadFile(csv, `ZOHO-Carga-Faturas-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
          toast.success(`ZOHO CSV: ${report.validInvoices}/${report.totalInvoices} válidas`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao exportar';
        toast.error(errorMessage);
      }
    },
    [invoices]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Processador de Notas Fiscais</h1>
              <p className="mt-1 text-sm text-slate-600">
                Extraia dados de PDFs de notas fiscais (NFS-e) de forma automática
              </p>
            </div>
            {invoices.length > 0 && (
              <button
                onClick={clearAll}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Limpar Tudo
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Inputs */}
          <div className="lg:col-span-1 space-y-6">
            <div className="sticky top-6 space-y-6">
              <ExcelUpload onFileLoaded={handleExcelLoaded} isLoading={isProcessing} />
              <PDFUpload
                onProcessComplete={async (results: ExtractedInvoice[]) => {
                  try {
                    console.log('[Home] Recebido ' + results.length + ' resultado(s) do PDFUpload');
                    addInvoices(results);
                    handlePDFsProcessed(results);
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Erro ao processar PDFs';
                    toast.error(errorMessage);
                  }
                }}
                isProcessing={isProcessing}
                progress={progress}
              />

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm font-medium text-red-900">Erro</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              )}

              {referenceData && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                  <p className="text-sm font-medium text-blue-900">Planilha Carregada</p>
                  <p className="text-sm text-blue-700 mt-1">{referenceData.length} registros</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2">
            {invoices.length > 0 ? (
              <ResultsTable
                invoices={invoices}
                onInvoiceUpdate={updateInvoice}
                onInvoiceDelete={removeInvoice}
                onExport={handleExport}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-slate-900">Nenhuma nota fiscal processada</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Carregue arquivos PDF de notas fiscais para começar
                </p>
              </div>
            )}
          </div>
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
