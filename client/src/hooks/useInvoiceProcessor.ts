/**
 * Hook customizado para gerenciar processamento de notas fiscais
 * Orquestra upload de Excel, processamento de PDFs e exportação de resultados
 */

import { useCallback, useState } from 'react';
import { processPDFInvoices } from '@/lib/pdfExtractor';
import { readExcelFile, readExcelFileAllSheets } from '@/lib/excelUtils';
import type { ExtractedInvoice, ExcelReferenceData, ProcessingResult } from '@/lib/types';

export function useInvoiceProcessor() {
  const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
  const [referenceData, setReferenceData] = useState<ExcelReferenceData[] | null>(null);
  const [allSheets, setAllSheets] = useState<Record<string, Record<string, unknown>[]> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carrega arquivo Excel de referência (todas as abas)
   */
  const loadExcelReference = useCallback(async (file: File) => {
    try {
      setError(null);
      const allData = await readExcelFileAllSheets(file);
      setAllSheets(allData);
      // Manter compatibilidade: primeira aba como referenceData
      const firstSheetName = Object.keys(allData)[0];
      const firstSheetData = allData[firstSheetName] || [];
      setReferenceData(firstSheetData);
      return firstSheetData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar Excel';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Processa múltiplos arquivos PDF
   */
  const processPDFs = useCallback(async (files: File[]) => {
    try {
      setError(null);
      setIsProcessing(true);
      setProgress(0);

      const results = await processPDFInvoices(files, (current, total) => {
        setProgress((current / total) * 100);
      });

      setInvoices(results);
      setProgress(100);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar PDFs';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Processa múltiplos PDFs em paralelo (mais rápido)
   */
  const processPDFsParallel = useCallback(async (files: File[]) => {
    try {
      setError(null);
      setIsProcessing(true);
      setProgress(0);

      console.log('[NFe] Iniciando processamento de ' + files.length + ' arquivo(s)');
      const results = await processPDFInvoices(files, (current, total) => {
        setProgress((current / total) * 100);
      });
      console.log('[NFe] Processamento concluido com ' + results.length + ' resultado(s)');
      console.log('[NFe] Resultados:', results);
      setInvoices(results);
      setProgress(100);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar PDFs';
      console.error('[NFe] ERRO durante processamento:', err);
      console.error('[NFe] Mensagem:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Atualiza uma nota fiscal extraída
   */
  const updateInvoice = useCallback((index: number, updates: Partial<ExtractedInvoice>) => {
    setInvoices((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  }, []);

  /**
   * Adiciona novas notas fiscais ao estado
   */
  const addInvoices = useCallback((newInvoices: ExtractedInvoice[]) => {
    setInvoices((prev) => [...prev, ...newInvoices]);
  }, []);

  /**
   * Remove uma nota fiscal da lista
   */
  const removeInvoice = useCallback((index: number) => {
    setInvoices((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Limpa todos os dados
   */
  const clearAll = useCallback(() => {
    setInvoices([]);
    setReferenceData(null);
    setAllSheets(null);
    setError(null);
    setProgress(0);
  }, []);

  /**
   * Retorna resultado do processamento
   */
  const getProcessingResult = useCallback((): ProcessingResult => {
    const errorCount = invoices.filter((inv) => (inv.extractionErrors?.length || 0) > 0).length;
    return {
      invoices,
      successCount: invoices.length - errorCount,
      errorCount,
      totalProcessed: invoices.length,
      errors: invoices
        .filter((inv) => (inv.extractionErrors?.length || 0) > 0)
        .flatMap((inv) =>
          (inv.extractionErrors || []).map((err) => ({
            filename: inv.filename,
            error: err,
            timestamp: new Date().toISOString(),
          }))
        ),
    };
  }, [invoices]);

  return {
    // Estado
    invoices,
    referenceData,
    allSheets,
    isProcessing,
    progress,
    error,

    // Ações
    loadExcelReference,
    processPDFs,
    processPDFsParallel,
    addInvoices,
    updateInvoice,
    removeInvoice,
    clearAll,
    getProcessingResult,
  };
}
