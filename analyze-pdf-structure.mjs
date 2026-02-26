/**
 * Script para analisar estrutura do PDF extraído
 * Ajuda a refinar os padrões regex
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pdfPath = path.join(__dirname, "client/public/test-invoice.pdf");
const text = execSync(`pdftotext "${pdfPath}" -`, { encoding: "utf-8" });

console.log("=== ANÁLISE DA ESTRUTURA DO PDF ===\n");

// Dividir por seções principais
const sections = {
  "Número da NFS-e": text.match(/Número da NFS-e[\s\S]{0,200}/),
  "Data e Hora de emissão": text.match(
    /Data e Hora de emissão da NFS-e[\s\S]{0,200}/
  ),
  EMITENTE: text.match(/EMITENTE DA NFS-e[\s\S]{0,500}/),
  TOMADOR: text.match(/TOMADOR DO SERVIÇO[\s\S]{0,500}/),
  "SERVIÇO PRESTADO": text.match(/SERVIÇO PRESTADO[\s\S]{0,800}/),
  "Valor do Serviço": text.match(/Valor do Serviço[\s\S]{0,200}/),
  "Valor Líquido": text.match(/Valor Líquido da NFS-e[\s\S]{0,200}/),
};

for (const [section, match] of Object.entries(sections)) {
  if (match) {
    console.log(`\n📍 ${section}:`);
    console.log("---");
    console.log(match[0]);
    console.log("---");
  }
}

// Buscar linhas com CNPJ
console.log("\n\n=== LINHAS COM CNPJ ===");
const lines = text.split("\n");
lines.forEach((line, idx) => {
  if (line.includes("CNPJ") || line.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)) {
    console.log(`Linha ${idx}: ${line}`);
  }
});

// Buscar linhas com valores monetários
console.log("\n\n=== LINHAS COM VALORES (R$) ===");
lines.forEach((line, idx) => {
  if (line.includes("R$") || line.match(/[\d.,]+\s*$/)) {
    console.log(`Linha ${idx}: ${line}`);
  }
});

// Salvar texto completo para análise manual
fs.writeFileSync(path.join(__dirname, "extracted-text.txt"), text);
console.log("\n\n✅ Texto completo salvo em: extracted-text.txt");
