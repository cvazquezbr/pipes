import { useState, useCallback } from "react";
import { compressPDFs, CompressionLevel } from "@/lib/pdfCompression";
import { toast } from "sonner";

interface CompressionResult {
  filename: string;
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
}

export function usePDFCompressor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<CompressionResult[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<CompressionLevel>("normal");

  const handleCompress = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const compressedResults = await compressPDFs(selectedFiles, level, (current, total) => {
        setProgress((current / total) * 100);
      });

      setResults(compressedResults);
      toast.success("Compactação concluída com sucesso!");
      return compressedResults;
    } catch (error) {
      console.error("Erro ao compactar:", error);
      toast.error("Ocorreu um erro durante a compactação");
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFiles, level]);

  const clearResults = useCallback(() => {
    setResults([]);
    setProgress(0);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFiles([]);
    setResults([]);
    setProgress(0);
  }, []);

  return {
    isProcessing,
    progress,
    results,
    selectedFiles,
    level,
    setLevel,
    setSelectedFiles,
    handleCompress,
    clearResults,
    clearSelection,
  };
}
