import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  FolderOpen,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  ChevronRight,
  Upload,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { usePDFCompressor } from "@/hooks/usePDFCompressor";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function PDFCompressor() {
  const {
    isProcessing,
    progress,
    results,
    selectedFiles,
    level,
    setLevel,
    setSelectedFiles,
    handleCompress,
    clearResults,
  } = usePDFCompressor();

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const pdfFiles = Array.from(files).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      toast.error("Nenhum arquivo PDF encontrado na pasta selecionada");
      return;
    }

    setSelectedFiles(pdfFiles);
    toast.success(`${pdfFiles.length} arquivos PDF selecionados`);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const pdfFiles = Array.from(files).filter(
      (file) =>
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    setSelectedFiles(pdfFiles);
  };

  const downloadAll = () => {
    results.forEach((result) => {
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `compressed_${result.filename}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
    toast.success("Downloads iniciados");
  };

  const totalOriginalSize = results.reduce((acc, r) => acc + r.originalSize, 0);
  const totalCompressedSize = results.reduce((acc, r) => acc + r.compressedSize, 0);
  const totalReduction = totalOriginalSize > 0
    ? ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100
    : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            Compactador de PDFs
          </CardTitle>
          <CardDescription>
            Selecione uma pasta ou arquivos PDF para reduzir o tamanho mantendo a capacidade de extração de texto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Nível de Compactação</Label>
            <RadioGroup
              defaultValue="normal"
              value={level}
              onValueChange={(v) => setLevel(v as any)}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              disabled={isProcessing}
            >
              <div>
                <RadioGroupItem
                  value="normal"
                  id="level-normal"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="level-normal"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <TrendingDown className="mb-2 h-6 w-6 text-slate-400 peer-data-[state=checked]:text-primary" />
                  <span className="text-sm font-bold">Normal</span>
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    Equilíbrio entre tamanho e qualidade. Ideal para a maioria dos casos.
                  </p>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="extreme"
                  id="level-extreme"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="level-extreme"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Zap className="mb-2 h-6 w-6 text-slate-400 peer-data-[state=checked]:text-primary" />
                  <span className="text-sm font-bold">Extrema</span>
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    Redução máxima de tamanho através da re-codificação de imagens.
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <input
                type="file"
                id="folder-upload"
                webkitdirectory=""
                directory=""
                className="hidden"
                onChange={handleFolderSelect}
                multiple
              />
              <label
                htmlFor="folder-upload"
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-6 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
              >
                <FolderOpen className="h-8 w-8 text-slate-400 group-hover:text-primary mb-2" />
                <span className="text-sm font-medium text-slate-600 group-hover:text-primary">Selecionar Pasta</span>
                <span className="text-xs text-slate-400 mt-1">Carrega todos os PDFs da pasta</span>
              </label>
            </div>

            <div className="relative">
                <input
                    type="file"
                    id="files-upload"
                    className="hidden"
                    onChange={handleFileSelect}
                    multiple
                    accept=".pdf"
                />
                <label
                    htmlFor="files-upload"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-6 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                >
                    <Upload className="h-8 w-8 text-slate-400 group-hover:text-primary mb-2" />
                    <span className="text-sm font-medium text-slate-600 group-hover:text-primary">Selecionar Arquivos</span>
                    <span className="text-xs text-slate-400 mt-1">Selecione um ou mais arquivos PDF</span>
                </label>
            </div>
          </div>

          {selectedFiles.length > 0 && results.length === 0 && (
            <div className="bg-slate-50 p-4 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedFiles.length} arquivos prontos</p>
                  <p className="text-xs text-slate-500">Clique no botão para iniciar a compactação</p>
                </div>
              </div>
              <Button onClick={handleCompress} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <ChevronRight className="mr-2 h-4 w-4" />
                    Iniciar Compactação
                  </>
                )}
              </Button>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-2 py-4">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Processando arquivos...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="animate-in fade-in zoom-in-95 duration-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Resultados da Compactação</CardTitle>
              <CardDescription>
                Resumo da redução de tamanho obtida
              </CardDescription>
            </div>
            <Button onClick={downloadAll} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Baixar Todos
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-50 p-4 rounded-lg text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tamanho Original</p>
                <p className="text-lg font-black text-slate-900">{formatSize(totalOriginalSize)}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tamanho Compactado</p>
                <p className="text-lg font-black text-primary">{formatSize(totalCompressedSize)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-[10px] font-bold text-green-600/60 uppercase tracking-widest mb-1">Economia Total</p>
                <p className="text-lg font-black text-green-600">{totalReduction.toFixed(1)}%</p>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-md border border-slate-100">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-slate-500 border-b">
                    <th className="text-left p-3 font-medium">Nome do Arquivo</th>
                    <th className="text-right p-3 font-medium">Original</th>
                    <th className="text-right p-3 font-medium">Compactado</th>
                    <th className="text-right p-3 font-medium text-green-600">Redução</th>
                    <th className="text-center p-3 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((result, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-medium text-slate-700 truncate max-w-[200px]" title={result.filename}>
                        {result.filename}
                      </td>
                      <td className="p-3 text-right text-slate-500">{formatSize(result.originalSize)}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{formatSize(result.compressedSize)}</td>
                      <td className="p-3 text-right font-bold text-green-600">
                        {result.reductionPercentage.toFixed(1)}%
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            const url = URL.createObjectURL(result.blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `compressed_${result.filename}`;
                            link.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="p-1 hover:text-primary transition-colors"
                          title="Baixar arquivo"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Extensão necessária para o TypeScript reconhecer o atributo webkitdirectory
declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}
