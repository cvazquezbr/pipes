/**
 * Debug de espaços em branco no PDF extraído
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pdfPath = path.join(__dirname, "client/public/test-invoice.pdf");
const text = execSync(`pdftotext "${pdfPath}" -`, { encoding: "utf-8" });

// Mostrar caracteres especiais
const section = text.match(/Número da NFS-e[\s\S]{0,100}/)[0];
console.log("=== Seção: Número da NFS-e ===");
console.log("Texto bruto:");
console.log(JSON.stringify(section));
console.log("\nCaracteres:");
for (let i = 0; i < section.length; i++) {
  const char = section[i];
  const code = char.charCodeAt(0);
  if (code < 32 || code > 126) {
    console.log(`[${i}] = ${JSON.stringify(char)} (code: ${code})`);
  }
}

// Testar padrões simples
console.log("\n=== Testes de Padrão ===");

const patterns = [
  { name: "Com \\s+\\n\\s+", pattern: /Número da NFS-e\s+\n\s+(\d+)/ },
  { name: "Com \\s+", pattern: /Número da NFS-e\s+(\d+)/ },
  { name: "Com [\\s\\S]+?", pattern: /Número da NFS-e[\s\S]+?(\d+)/ },
  { name: "Simples", pattern: /Número da NFS-e.*?(\d+)/i },
];

for (const { name, pattern } of patterns) {
  const match = text.match(pattern);
  console.log(`${name}: ${match ? "✅ " + match[1] : "❌"}`);
}
