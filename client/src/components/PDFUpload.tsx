/**
 * Componente para upload de múltiplos arquivos PDF de notas fiscais
 * Suporta drag-drop, processamento em paralelo e barra de progresso
 */

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, FileText, Loader2, Play, Upload, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import type { ExtractedInvoice } from '@/lib/types';

interface PDFUploadProps {
  onProcessComplete: (invoices: ExtractedInvoice[]) => void;
  onProcess?: (files: File[]) => Promise<ExtractedInvoice[]>;
  isProcessing?: boolean;
  progress?: number;
}

export function PDFUpload({
  onProcessComplete,
  onProcess,
  isProcessing = false,
  progress = 0
}: PDFUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);

      // Filtrar apenas PDFs
      const pdfFiles = acceptedFiles.filter((file) => file.type === 'application/pdf');

      if (pdfFiles.length === 0) {
        setError('Nenhum arquivo PDF válido foi selecionado');
        return;
      }

      if (pdfFiles.length + selectedFiles.length > 50) {
        setError('Máximo de 50 arquivos permitidos');
        return;
      }

      setSelectedFiles((prev) => [...prev, ...pdfFiles]);
    },
    [selectedFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    disabled: isProcessing,
  });

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setError(null);
  };

  const handleProcess = async () => {
    if (selectedFiles.length === 0) {
      setError('Selecione pelo menos um arquivo PDF');
      return;
    }

    try {
      setError(null);

      let results: ExtractedInvoice[];

      if (onProcess) {
        // Se o pai proveu uma função de processamento, usa ela (para gerenciar estado global)
        results = await onProcess(selectedFiles);
      } else {
        // Fallback para processamento local
        console.log('[PDFUpload] Iniciando processamento local de ' + selectedFiles.length + ' arquivo(s)');
        const { processPDFInvoices } = await import('@/lib/pdfExtractor');
        results = await processPDFInvoices(selectedFiles);
        console.log('[PDFUpload] Processamento local concluido');
        onProcessComplete(results);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar PDFs';
      console.error('[PDFUpload] ERRO:', err);
      console.error('[PDFUpload] Mensagem:', errorMessage);
      setError(errorMessage);
    }
  };

  const dragActiveClass = isDragActive
    ? 'border-primary bg-primary/5'
    : 'border-muted-foreground/25 hover:border-muted-foreground/50';
  const disabledClass = isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Arquivos PDF
        </CardTitle>
        <CardDescription>Carregue um ou mais arquivos PDF de notas fiscais</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedFiles.length === 0 ? (
          <div
            {...getRootProps()}
            className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragActiveClass} ${disabledClass}`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              {isDragActive ? 'Solte os arquivos aqui' : 'Arraste arquivos PDF aqui ou clique para selecionar'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Máximo de 50 arquivos</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{selectedFiles.length} arquivo(s) selecionado(s)</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={isProcessing}
              >
                Limpar
              </Button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border bg-muted/50 p-2">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between rounded bg-background p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm truncate">{file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(idx)}
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {isProcessing && progress > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Processando...</p>
                  <p className="text-xs font-medium">{Math.round(progress)}%</p>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <Button
              onClick={handleProcess}
              disabled={isProcessing || selectedFiles.length === 0}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Processar PDFs
                </>
              )}
            </Button>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
