/**
 * Script de teste simplificado para validar extração de PDF
 * Usa ferramentas de linha de comando disponíveis
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testExtraction() {
  const pdfPath = path.join(__dirname, "client/public/test-invoice.pdf");

  if (!fs.existsSync(pdfPath)) {
    console.error("❌ Arquivo PDF não encontrado:", pdfPath);
    process.exit(1);
  }

  console.log("📄 Testando extração de PDF...\n");

  try {
    // Usar pdftotext para extrair texto
    const text = execSync(`pdftotext "${pdfPath}" -`, { encoding: "utf-8" });

    console.log("✅ Texto extraído com sucesso!\n");
    console.log("--- PRIMEIROS 1500 CARACTERES ---");
    console.log(text.substring(0, 1500));
    console.log("\n--- PADRÕES DE BUSCA ---\n");

    // Testar padrões
    const patterns = {
      nfsNumber: /Número da NFS-e\s+(\d+)/i,
      accessKey: /Chave de Acesso da NFS-e\s+([\d\s]+)/i,
      emissionDate: /Data e Hora de emissão da NFS-e\s+(\d{2}\/\d{2}\/\d{4})/i,
      issuerName:
        /EMITENTE DA NFS-e[\s\S]*?Nome \/ Nome Empresarial\s+([^\n]+?)(?=\n|Endereço)/i,
      issuerCNPJ:
        /EMITENTE DA NFS-e[\s\S]*?CNPJ \/ CPF \/ NIF\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i,
      takerName:
        /TOMADOR DO SERVIÇO[\s\S]*?Nome \/ Nome Empresarial\s+([^\n]+?)(?=\n|Endereço)/i,
      takerCNPJ:
        /TOMADOR DO SERVIÇO[\s\S]*?CNPJ \/ CPF \/ NIF\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i,
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

    console.log(
      `\n📊 Resultado: ${foundCount}/${Object.keys(patterns).length} padrões encontrados`
    );

    if (foundCount >= 8) {
      console.log(
        "\n✨ Extração bem-sucedida! A maioria dos campos foi identificada."
      );
    } else {
      console.log(
        "\n⚠️  Alguns campos não foram encontrados. Pode ser necessário ajustar os padrões regex."
      );
    }
  } catch (error) {
    console.error("❌ Erro ao processar PDF:", error.message);
    process.exit(1);
  }
}

testExtraction();
