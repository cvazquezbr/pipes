/**
 * Componente para upload de arquivo JSON
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
import { AlertCircle, FileCode, Loader2, Upload, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface JsonUploadProps {
  onFileLoaded: (data: any, file: File) => void;
  isLoading?: boolean;
  title?: string;
  description?: string;
  onClear?: () => void;
}

export function JsonUpload({
  onFileLoaded,
  isLoading = false,
  title = "Carga de Arquivo JSON",
  description = "Carregue um arquivo JSON com dados dos trabalhadores",
  onClear,
}: JsonUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);

      if (acceptedFiles.length === 0) {
        setError("Nenhum arquivo válido foi selecionado");
        return;
      }

      const file = acceptedFiles[0];

      // Validar extensão
      if (!file.name.toLowerCase().endsWith(".json")) {
        setError("Formato inválido. Use: .json");
        return;
      }

      const reader = new FileReader();
      reader.onload = event => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);
          setFileName(file.name);
          onFileLoaded(data, file);
        } catch (err) {
          setError("Erro ao processar arquivo JSON: Formato inválido");
        }
      };
      reader.onerror = () => {
        setError("Erro ao ler arquivo");
      };
      reader.readAsText(file);
    },
    [onFileLoaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/json": [".json"],
    },
    disabled: isLoading,
    multiple: false,
  });

  const handleClear = () => {
    setFileName(null);
    setError(null);
    if (onClear) onClear();
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
          <FileCode className="h-5 w-5 text-primary" />
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
                ? "Processando JSON..."
                : isDragActive
                  ? "Solte o arquivo aqui"
                  : "Arraste um arquivo JSON aqui ou clique para selecionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Formato suportado: .json
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-muted p-3">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-primary" />
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
