import { PDFDocument, PDFRawStream, PDFName, PDFDict } from "pdf-lib";

export type CompressionLevel = "normal" | "extreme";

/**
 * Re-compacta uma imagem em buffer para reduzir seu tamanho.
 * Usa o Canvas do navegador para converter para JPEG com qualidade reduzida.
 */
async function recompressImage(
  imageData: Uint8Array,
  mimeType: string = "image/jpeg",
  quality: number = 0.5
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([imageData], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Não foi possível obter o contexto do canvas"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Falha ao criar blob do canvas"));
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(new Uint8Array(reader.result as ArrayBuffer));
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Erro ao carregar imagem para recompactação"));
    };

    img.src = url;
  });
}

/**
 * Compacta um arquivo PDF tentando reduzir seu tamanho ao máximo
 * sem perder a capacidade de extração de texto.
 */
export async function compressPDF(
  file: File,
  level: CompressionLevel = "normal"
): Promise<{
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  if (level === "extreme") {
    const context = pdfDoc.context;
    const indirectObjects = context.enumerateIndirectObjects();

    for (const [ref, obj] of indirectObjects) {
      if (obj instanceof PDFRawStream) {
        const dict = obj.dict;
        const subtype = dict.get(PDFName.of("Subtype"));

        if (subtype === PDFName.of("Image")) {
          try {
            // Tenta obter o filtro para saber se é uma imagem que podemos processar
            const filter = dict.get(PDFName.of("Filter"));
            const isDCT = filter === PDFName.of("DCTDecode") ||
                         (Array.isArray(filter) && filter.includes(PDFName.of("DCTDecode")));

            // Apenas tentamos recompactar se for uma imagem e tiver um tamanho considerável
            if (obj.contents.length > 50 * 1024) { // > 50KB
               // Para imagens grandes, tentamos recompactar via canvas
               // Nota: Isso pode falhar dependendo do formato de cor (CMYK vs RGB)
               // Mas como fallback, se falhar, mantemos a original.
               try {
                 const newContents = await recompressImage(obj.contents);
                 if (newContents.length < obj.contents.length) {
                   const entries: Record<string, any> = {};
                   dict.entries().forEach(([key, value]) => {
                     entries[key.toString()] = value;
                   });

                   const newStream = context.flateStream(newContents, {
                     ...entries,
                     Filter: PDFName.of("FlateDecode"),
                   });
                   context.assign(ref, newStream);
                 }
               } catch (e) {
                 console.warn("Falha ao recompactar imagem interna do PDF:", e);
               }
            }
          } catch (e) {
            // Ignora erros em objetos específicos
          }
        }
      }
    }
  }

  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });

  const originalSize = file.size;
  const compressedSize = compressedBytes.length;
  const reductionPercentage =
    ((originalSize - compressedSize) / originalSize) * 100;

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
  level: CompressionLevel = "normal",
  onProgress?: (current: number, total: number) => void
): Promise<
  Array<{
    filename: string;
    blob: Blob;
    originalSize: number;
    compressedSize: number;
    reductionPercentage: number;
  }>
> {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await compressPDF(file, level);
      results.push({
        filename: file.name,
        ...result,
      });
    } catch (error) {
      console.error(`Erro ao compactar ${file.name}:`, error);
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
