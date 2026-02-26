import * as pdfjsLib from "pdfjs-dist";
import { readFile } from "fs/promises";
import { parseInformeText } from "./client/src/lib/informeExtractor.js";

async function debugPDF(filePath) {
  try {
    const data = await readFile(filePath);
    const uint8Array = new Uint8Array(data);
    const pdf = await pdfjsLib.getDocument({ data: uint8Array, verbosity: 0 }).promise;

    let fullText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    console.log("--- TEXTO EXTRAÍDO ---");
    console.log(fullText);
    console.log("--- FIM DO TEXTO ---");

    const result = parseInformeText(fullText);
    console.log("--- RESULTADO DO PARSE ---");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Erro ao processar PDF:", error);
  }
}

const file = process.argv[2] || "client/public/test-invoice.pdf";
debugPDF(file);
