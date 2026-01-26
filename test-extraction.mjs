/**
 * Script de teste para validar extração de dados do PDF
 * Executa: node test-extraction.mjs
 */

import * as pdfjsLib from 'pdfjs-dist';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configurar worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

async function extractTextFromPDF(filePath) {
  const data = fs.readFileSync(filePath);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

async function testExtraction() {
  const pdfPath = path.join(__dirname, 'client/public/test-invoice.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.error('❌ Arquivo PDF não encontrado:', pdfPath);
    process.exit(1);
  }

  console.log('📄 Testando extração de PDF...\n');

  try {
    const text = await extractTextFromPDF(pdfPath);

    console.log('✅ Texto extraído com sucesso!\n');
    console.log('--- PRIMEIROS 1000 CARACTERES ---');
    console.log(text.substring(0, 1000));
    console.log('\n--- PADRÕES DE BUSCA ---\n');

    // Testar padrões
    const patterns = {
      nfsNumber: /Número da NFS-e\s+(\d+)/i,
      accessKey: /Chave de Acesso da NFS-e\s+([\d\s]+)/i,
      emissionDate: /Data e Hora de emissão da NFS-e\s+(\d{2}\/\d{2}\/\d{4})/i,
      issuerName: /Nome \/ Nome Empresarial\s+([^\n]+?)(?=\n|Endereço|CNPJ)/i,
      issuerCNPJ: /EMITENTE DA NFS-e[\s\S]*?CNPJ \/ CPF \/ NIF\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i,
      takerName: /TOMADOR DO SERVIÇO[\s\S]*?Nome \/ Nome Empresarial\s+([^\n]+?)(?=\n|Endereço|CNPJ)/i,
      takerCNPJ: /TOMADOR DO SERVIÇO[\s\S]*?CNPJ \/ CPF \/ NIF\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i,
      serviceValue: /Valor do Serviço\s+R\$\s+([\d.,]+)/i,
      netValue: /Valor Líquido da NFS-e\s+R\$\s+([\d.,]+)/i,
    };

    let foundCount = 0;
    for (const [name, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        console.log(`✅ ${name}: ${match[1].trim()}`);
        foundCount++;
      } else {
        console.log(`❌ ${name}: NÃO ENCONTRADO`);
      }
    }

    console.log(`\n📊 Resultado: ${foundCount}/${Object.keys(patterns).length} padrões encontrados`);

    if (foundCount >= 8) {
      console.log('\n✨ Extração bem-sucedida! A maioria dos campos foi identificada.');
    } else {
      console.log('\n⚠️  Alguns campos não foram encontrados. Pode ser necessário ajustar os padrões regex.');
    }
  } catch (error) {
    console.error('❌ Erro ao processar PDF:', error.message);
    process.exit(1);
  }
}

testExtraction();
