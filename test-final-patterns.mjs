import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = path.join(__dirname, 'client/public/test-invoice.pdf');
const text = execSync(`pdftotext "${pdfPath}" -`, { encoding: 'utf-8' });

console.log('=== TESTE FINAL DE PADRÕES ===\n');

const patterns = {
  nfsNumber: /Número da NFS-e[\s\S]+?(\d+)(?=\n)/,
  accessKey: /Chave de Acesso da NFS-e[\s\S]+?([\d]+)(?=\n)/,
  seriesNumber: /Série da DPS[\s\S]+?(\d+)(?=\n)/,
  emissionDate: /Data e Hora de emissão da NFS-e[\s\S]+?(\d{2}\/\d{2}\/\d{4})/,
  emissionTime: /Data e Hora de emissão da DPS[\s\S]+?(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,
  issuerName: /EMITENTE DA NFS-e[\s\S]*?Nome \/ Nome Empresarial[\s\S]+?([^\n]+?)(?=\n|E-mail)/,
  issuerCNPJ: /EMITENTE DA NFS-e[\s\S]*?CNPJ \/ CPF \/ NIF[\s\S]+?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/,
  takerName: /TOMADOR DO SERVIÇO[\s\S]*?Nome \/ Nome Empresarial[\s\S]+?([^\n]+?)(?=\n|E-mail)/,
  takerCNPJ: /TOMADOR DO SERVIÇO[\s\S]*?CNPJ \/ CPF \/ NIF[\s\S]+?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/,
  netValue: /Valor Líquido da NFS-e[\s\S]+?R\$\s+([\d.,]+)/,
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
