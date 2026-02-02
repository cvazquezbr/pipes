/**
 * Teste de padrões refinados
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pdfPath = path.join(__dirname, 'client/public/test-invoice.pdf');
const text = execSync(`pdftotext "${pdfPath}" -`, { encoding: 'utf-8' });

console.log('=== TESTE DE PADRÕES REFINADOS ===\n');

const patterns = {
  nfsNumber: /Número da NFS-e\s+\n\s+(\d+)/i,
  accessKey: /Chave de Acesso da NFS-e\s+\n\s+([\d]+)/i,
  seriesNumber: /Série da DPS\s+\n\s+(\d+)/i,
  emissionDate: /Data e Hora de emissão da NFS-e\s+\n\s+(\d{2}\/\d{2}\/\d{4})/i,
  emissionTime: /Data e Hora de emissão da DPS\s+\n\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i,
  issuerName: /EMITENTE DA NFS-e[\s\S]*?Nome \/ Nome Empresarial\s+\n\s+([^\n]+)/i,
  issuerCNPJ: /EMITENTE DA NFS-e[\s\S]*?CNPJ \/ CPF \/ NIF\s+\n\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i,
  takerName: /TOMADOR DO SERVIÇO[\s\S]*?Nome \/ Nome Empresarial\s+\n\s+([^\n]+)/i,
  takerCNPJ: /TOMADOR DO SERVIÇO[\s\S]*?CNPJ \/ CPF \/ NIF\s+\n\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i,
  netValue: /Valor Líquido da NFS-e\s+\n\s+R\$\s+([\d.,]+)/i,
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

// Debug: mostrar seção de emitente
console.log('\n=== DEBUG: Seção EMITENTE ===');
const emitentMatch = text.match(/EMITENTE DA NFS-e[\s\S]{0,500}/);
if (emitentMatch) {
  console.log(emitentMatch[0]);
}
