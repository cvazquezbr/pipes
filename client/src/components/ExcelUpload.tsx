/**
 * Componente para upload de planilha Excel de referência
 * Suporta drag-drop e validação de formato
 */

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ExcelReferenceData } from '@/lib/types';

interface ExcelUploadProps {
  onFileLoaded: (data: ExcelReferenceData[], file: File) => void;
  isLoading?: boolean;
}

export function ExcelUpload({ onFileLoaded, isLoading = false }: ExcelUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [allSheets, setAllSheets] = useState<Record<string, ExcelReferenceData[]> | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);

      if (acceptedFiles.length === 0) {
        setError('Nenhum arquivo válido foi selecionado');
        return;
      }

      const file = acceptedFiles[0];

      // Validar extensão
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!validExtensions.includes(fileExtension)) {
        setError(`Formato inválido. Use: ${validExtensions.join(', ')}`);
        return;
      }

      try {
        setFileName(file.name);
        const { readExcelFileAllSheets } = await import('@/lib/excelUtils');
        const data = await readExcelFileAllSheets(file) as Record<string, ExcelReferenceData[]>;
        setAllSheets(data);

        const sheetNames = Object.keys(data);
        if (sheetNames.length > 0) {
          setActiveTab(sheetNames[0]);
          onFileLoaded(data[sheetNames[0]], file);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao processar arquivo';
        setError(errorMessage);
        setFileName(null);
        setAllSheets(null);
        setActiveTab(null);
      }
    },
    [onFileLoaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    disabled: isLoading,
    multiple: false,
  });

  const handleClear = () => {
    setFileName(null);
    setAllSheets(null);
    setActiveTab(null);
    setError(null);
  };

  const dragActiveClass = isDragActive
    ? 'border-primary bg-primary/5'
    : 'border-muted-foreground/25 hover:border-muted-foreground/50';
  const disabledClass = isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Planilha de Referência
        </CardTitle>
        <CardDescription>Carregue um arquivo Excel com dados de referência (opcional)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!fileName ? (
          <div
            {...getRootProps()}
            className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragActiveClass} ${disabledClass}`}
          >
            <input {...getInputProps()} />
            {isLoading ? (
              <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-2" />
            ) : (
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            )}
            <p className="text-sm font-medium">
              {isLoading
                ? 'Processando planilha...'
                : isDragActive
                ? 'Solte o arquivo aqui'
                : 'Arraste um arquivo Excel aqui ou clique para selecionar'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Formatos suportados: .xlsx, .xls, .csv</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium truncate">{fileName}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {allSheets && Object.keys(allSheets).length > 0 && activeTab && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Abas detectadas:</p>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="flex flex-wrap h-auto p-1 bg-muted/50">
                    {Object.keys(allSheets).map((sheetName) => (
                      <TabsTrigger
                        key={sheetName}
                        value={sheetName}
                        className="text-[10px] px-2 py-1 h-7"
                      >
                        {sheetName}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {Object.entries(allSheets).map(([sheetName, rows]) => (
                    <TabsContent key={sheetName} value={sheetName} className="mt-2 outline-none">
                      <div className="max-h-48 overflow-auto rounded-lg border bg-muted/30">
                        {rows.length > 0 ? (
                          <table className="w-full text-[10px] border-collapse">
                            <thead className="sticky top-0 bg-muted-foreground/5 backdrop-blur-sm">
                              <tr className="border-b">
                                {Object.keys(rows[0] || {}).map((key) => (
                                  <th key={key} className="px-2 py-1.5 text-left font-bold text-slate-700">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.slice(0, 5).map((row, idx) => (
                                <tr key={idx} className="border-b last:border-0 bg-white/50 hover:bg-white/80 transition-colors">
                                  {Object.values(row).map((value, cellIdx) => (
                                    <td key={cellIdx} className="px-2 py-1.5 truncate max-w-[150px] text-slate-600">
                                      {String(value !== undefined && value !== null ? value : '')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="p-4 text-center text-muted-foreground italic">
                            Aba vazia
                          </div>
                        )}
                      </div>
                      {rows.length > 5 && (
                        <p className="text-[9px] text-muted-foreground text-right mt-1 font-medium">
                          Mostrando apenas as primeiras 5 de {rows.length} linhas
                        </p>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}
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
