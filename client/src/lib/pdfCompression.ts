import { PDFDocument } from "pdf-lib";

/**
 * Compacta um arquivo PDF tentando reduzir seu tamanho ao máximo
 * sem perder a capacidade de extração de texto.
 *
 * @param file O arquivo PDF original
 * @returns O arquivo PDF compactado como Blob
 */
export async function compressPDF(file: File): Promise<{
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
}> {
  const arrayBuffer = await file.arrayBuffer();

  // Carrega o documento
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  // A compactação no pdf-lib é feita principalmente ao salvar
  // com a opção useObjectStreams: true, que agrupa objetos em streams
  // e remove objetos duplicados/não utilizados.
  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });

  const originalSize = file.size;
  const compressedSize = compressedBytes.length;
  const reductionPercentage = ((originalSize - compressedSize) / originalSize) * 100;

  const blob = new Blob([compressedBytes], { type: "application/pdf" });

  return {
    blob,
    originalSize,
    compressedSize,
    reductionPercentage: Math.max(0, reductionPercentage),
  };
}

/**
 * Compacta múltiplos arquivos PDF
 */
export async function compressPDFs(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<Array<{
  filename: string;
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
}>> {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await compressPDF(file);
      results.push({
        filename: file.name,
        ...result,
      });
    } catch (error) {
      console.error(`Erro ao compactar ${file.name}:`, error);
      // Em caso de erro, mantém o original (ou decide como tratar)
      results.push({
        filename: file.name,
        blob: new Blob([await file.arrayBuffer()], { type: "application/pdf" }),
        originalSize: file.size,
        compressedSize: file.size,
        reductionPercentage: 0,
      });
    }

    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }

  return results;
}
