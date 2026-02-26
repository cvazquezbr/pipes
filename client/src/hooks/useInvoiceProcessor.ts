/**
 * Hook customizado para gerenciar processamento de notas fiscais
 * Orquestra upload de Excel, processamento de PDFs e exportação de resultados
 */

import { useCallback, useState } from "react";
import { processPDFInvoices } from "@/lib/pdfExtractor";
import { readExcelFile, readExcelFileAllSheets } from "@/lib/excelUtils";
import type {
  ExtractedInvoice,
  ExcelReferenceData,
  ProcessingResult,
} from "@/lib/types";

export function useInvoiceProcessor() {
  const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
  const [referenceData, setReferenceData] = useState<
    ExcelReferenceData[] | null
  >(null);
  const [allSheets, setAllSheets] = useState<Record<
    string,
    Record<string, unknown>[]
  > | null>(null);
  const [invoiceSheetData, setInvoiceSheetData] = useState<
    Record<string, unknown>[]
  >([]);
  const [billSheetData, setBillSheetData] = useState<Record<string, unknown>[]>(
    []
  );
  const [workerData, setWorkerData] = useState<any[]>([]);
  const [extractedInformes, setExtractedInformes] = useState<any[]>([]);
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
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao carregar Excel";
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Carrega planilha de faturamento (Invoices)
   */
  const loadInvoiceSheet = useCallback(async (file: File) => {
    try {
      setError(null);
      const data = await readExcelFile(file);
      setInvoiceSheetData(data);
      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao carregar faturamento";
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Carrega planilha de cobrança (Bills)
   */
  const loadBillSheet = useCallback(async (file: File) => {
    try {
      setError(null);
      const data = await readExcelFile(file);
      // Filtro: Apenas registros cujo Bill Number contenha " ISS"
      const filteredData = data.filter(row => {
        // Busca a chave 'Bill Number' de forma robusta
        const billNumberKey =
          Object.keys(row).find(
            k => k.trim().toLowerCase() === "bill number"
          ) || "Bill Number";
        const billNumber = String(row[billNumberKey] || "");
        return billNumber.toUpperCase().includes(" ISS");
      });
      setBillSheetData(filteredData);
      return filteredData;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao carregar cobrança";
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Carrega dados de trabalhadores (JSON)
   */
  const loadWorkerData = useCallback((data: any) => {
    setWorkerData(Array.isArray(data) ? data : [data]);
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
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao processar PDFs";
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

      console.log(
        "[NFe] Iniciando processamento de " + files.length + " arquivo(s)"
      );
      const results = await processPDFInvoices(files, (current, total) => {
        setProgress((current / total) * 100);
      });
      console.log(
        "[NFe] Processamento concluido com " + results.length + " resultado(s)"
      );
      console.log("[NFe] Resultados:", results);
      setInvoices(results);
      setProgress(100);
      return results;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao processar PDFs";
      console.error("[NFe] ERRO durante processamento:", err);
      console.error("[NFe] Mensagem:", errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Atualiza uma nota fiscal extraída
   */
  const updateInvoice = useCallback(
    (index: number, updates: Partial<ExtractedInvoice>) => {
      setInvoices(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], ...updates };
        return updated;
      });
    },
    []
  );

  /**
   * Adiciona novas notas fiscais ao estado
   */
  const addInvoices = useCallback((newInvoices: ExtractedInvoice[]) => {
    setInvoices(prev => [...prev, ...newInvoices]);
  }, []);

  /**
   * Remove uma nota fiscal da lista
   */
  const removeInvoice = useCallback((index: number) => {
    setInvoices(prev => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Limpa todos os dados
   */
  const clearAll = useCallback(() => {
    setInvoices([]);
    setReferenceData(null);
    setAllSheets(null);
    setInvoiceSheetData([]);
    setBillSheetData([]);
    setWorkerData([]);
    setExtractedInformes([]);
    setError(null);
    setProgress(0);
  }, []);

  /**
   * Retorna resultado do processamento
   */
  const getProcessingResult = useCallback((): ProcessingResult => {
    const errorCount = invoices.filter(
      inv => (inv.extractionErrors?.length || 0) > 0
    ).length;
    return {
      invoices,
      successCount: invoices.length - errorCount,
      errorCount,
      totalProcessed: invoices.length,
      errors: invoices
        .filter(inv => (inv.extractionErrors?.length || 0) > 0)
        .flatMap(inv =>
          (inv.extractionErrors || []).map(err => ({
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
    invoiceSheetData,
    billSheetData,
    workerData,
    extractedInformes,
    isProcessing,
    progress,
    error,

    // Ações
    loadExcelReference,
    loadInvoiceSheet,
    loadBillSheet,
    loadWorkerData,
    setExtractedInformes,
    processPDFs,
    processPDFsParallel,
    addInvoices,
    updateInvoice,
    removeInvoice,
    clearAll,
    getProcessingResult,
  };
}
