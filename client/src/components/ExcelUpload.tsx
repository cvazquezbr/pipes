/**
 * Componente para upload de planilha Excel de referência
 * Suporta drag-drop e validação de formato
 */

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExcelReferenceData } from "@/lib/types";

interface ExcelUploadProps {
  onFileLoaded: (
    data: Record<string, Record<string, unknown>[]>,
    file: File
  ) => void;
  isLoading?: boolean;
  title?: string;
  description?: string;
  rowFilter?: (row: Record<string, unknown>) => boolean;
}

export function ExcelUpload({
  onFileLoaded,
  isLoading = false,
  title = "Planilha de Referência",
  description = "Carregue um arquivo Excel com dados de referência (opcional)",
  rowFilter,
}: ExcelUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [allSheetsData, setAllSheetsData] = useState<Record<
    string,
    ExcelReferenceData[]
  > | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);

      if (acceptedFiles.length === 0) {
        setError("Nenhum arquivo válido foi selecionado");
        return;
      }

      const file = acceptedFiles[0];

      // Validar extensão
      const validExtensions = [".xlsx", ".xls", ".csv"];
      const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();

      if (!validExtensions.includes(fileExtension)) {
        setError(`Formato inválido. Use: ${validExtensions.join(", ")}`);
        return;
      }

      try {
        setFileName(file.name);
        const { readExcelFileAllSheets } = await import("@/lib/excelUtils");
        const sheetsData = await readExcelFileAllSheets(file);

        // Carregar todas as linhas de cada aba para exibição
        const allData: Record<string, ExcelReferenceData[]> = {};
        Object.keys(sheetsData).forEach(sheetName => {
          let rows = sheetsData[sheetName] as ExcelReferenceData[];
          if (rowFilter) {
            rows = rows.filter(rowFilter as any);
          }
          allData[sheetName] = rows;
        });

        setAllSheetsData(allData);

        // Enviar a primeira aba para manter compatibilidade com o hook atual
        const firstSheetName = Object.keys(sheetsData)[0];
        onFileLoaded(sheetsData, file);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Erro ao processar arquivo";
        setError(errorMessage);
        setFileName(null);
        setAllSheetsData(null);
      }
    },
    [onFileLoaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    disabled: isLoading,
    multiple: false,
  });

  const handleClear = () => {
    setFileName(null);
    setAllSheetsData(null);
    setError(null);
  };

  const dragActiveClass = isDragActive
    ? "border-primary bg-primary/5"
    : "border-muted-foreground/25 hover:border-muted-foreground/50";
  const disabledClass = isLoading
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  return (
    <Card className="w-full border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
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
                ? "Processando planilha..."
                : isDragActive
                  ? "Solte o arquivo aqui"
                  : "Arraste um arquivo Excel aqui ou clique para selecionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Formatos suportados: .xlsx, .xls, .csv
            </p>
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

            {allSheetsData && Object.keys(allSheetsData).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Dados carregados:
                </p>

                <Tabs
                  defaultValue={Object.keys(allSheetsData)[0]}
                  className="w-full"
                >
                  <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-muted/50">
                    {Object.keys(allSheetsData).map(sheetName => (
                      <TabsTrigger
                        key={sheetName}
                        value={sheetName}
                        className="text-xs py-1 px-3"
                      >
                        {sheetName}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {Object.entries(allSheetsData).map(([sheetName, rows]) => {
                    const headers = new Set<string>();
                    rows.forEach(row =>
                      Object.keys(row).forEach(k => headers.add(k))
                    );
                    const headerList = Array.from(headers);

                    return (
                      <TabsContent
                        key={sheetName}
                        value={sheetName}
                        className="mt-2"
                        anchor-id={sheetName}
                      >
                        <div className="max-h-96 overflow-auto rounded-lg border bg-muted/50 p-2">
                          {rows.length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  {headerList.map(key => (
                                    <th
                                      key={key}
                                      className="px-2 py-1 text-left font-medium"
                                    >
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row, idx) => (
                                  <tr
                                    key={idx}
                                    className="border-b last:border-0"
                                  >
                                    {headerList.map(key => (
                                      <td
                                        key={key}
                                        className="px-2 py-1 truncate max-w-[200px]"
                                      >
                                        {String(
                                          row[key] !== undefined ? row[key] : ""
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-center py-4 text-muted-foreground italic">
                              Aba vazia
                            </p>
                          )}
                        </div>
                      </TabsContent>
                    );
                  })}
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
