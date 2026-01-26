# Arquitetura - Processador de Notas Fiscais (NFS-e)

## Análise do PDF de Referência (NFe26-TRE-PI.pdf)

### Estrutura do Documento
O PDF é uma **DANFSe (Documento Auxiliar da NFS-e)** - documento visual que representa uma Nota Fiscal de Serviço eletrônica. Contém:

#### Seções Principais
1. **Cabeçalho**: Informações da NFS-e
   - Chave de Acesso: `32053092202434797000160000000000262601348692869`
   - Número da NFS-e: `26`
   - Data/Hora de emissão: `21/01/2026 11:08:45`
   - Série: `900`

2. **Emitente (Prestador de Serviço)**
   - Nome: `FATTO CONSULTORIA E SISTEMAS LTDA`
   - CNPJ: `02.434.797/0001-60`
   - Endereço: `JERÔNIMO MONTEIRO, 1000, CENTRO`
   - Município: `Vitória - ES`
   - CEP: `29010-004`

3. **Tomador do Serviço (Cliente)**
   - Nome: `TRIBUNAL REGIONAL ELEITORAL DO PIAUÍ`
   - CNPJ: `05.957.363/0001-33`
   - Endereço: `FRCA DES. EDGAR NOGUEIRA CENTRO CIVICO, S/N, PREDIO, CABRAL`
   - Município: `Teresina - PI`
   - CEP: `64000-830`

4. **Descrição do Serviço**
   - Código de Tributação Nacional: `01.01.01`
   - Descrição: `Análise e desenvolvimento de sistemas`
   - Detalhes: Contrato específico com datas e valores

5. **Valores Financeiros**
   - Valor do Serviço: `R$ 88.938,37`
   - Deduções/Retenções: Vários tributos (IRRF, PIS, COFINS, etc.)
   - Valor Líquido: `R$ 72.973,94`

6. **Tributação**
   - Municipal (ISSQN): `2,00%`
   - Federal: `11,33%`
   - Estadual: `0,00%`

### Campos a Extrair
**Essenciais:**
- Número da NFS-e
- Chave de Acesso
- Data de Emissão
- Valor Total
- Valor Líquido
- CNPJ/CPF do Emitente
- CNPJ/CPF do Tomador
- Nome do Emitente
- Nome do Tomador
- Descrição do Serviço

**Adicionais:**
- Série
- Impostos (IRRF, PIS, COFINS, ISSQN)
- Endereços
- Telefones/E-mails

---

## Estratégia de Extração

### Abordagem: PDF Text Extraction + Regex Patterns
Como o PDF é um documento visual estruturado (DANFSe), usaremos:

1. **pdfjs-dist**: Extrai texto do PDF mantendo estrutura
2. **Regex Patterns**: Padrões para identificar campos específicos
3. **Fallback Manual**: Interface para correção manual se extração falhar

### Fluxo de Processamento
```
1. Upload Excel de Referência
   ↓
2. Carregar PDFs do cliente (drag-drop ou file input)
   ↓
3. Para cada PDF:
   a. Extrair texto completo
   b. Aplicar regex patterns para cada campo
   c. Validar contra planilha de referência (se aplicável)
   d. Armazenar em estrutura JSON
   ↓
4. Exportar resultados (CSV, JSON ou Excel)
```

---

## Estrutura de Dados

### Tipo TypeScript: ExtractedInvoice
```typescript
interface ExtractedInvoice {
  // Identificação
  nfsNumber: string;
  accessKey: string;
  seriesNumber: string;
  
  // Datas
  emissionDate: string;
  emissionTime: string;
  
  // Emitente (Prestador)
  issuerName: string;
  issuerCNPJ: string;
  issuerAddress: string;
  issuerCity: string;
  issuerState: string;
  issuerCEP: string;
  issuerPhone?: string;
  issuerEmail?: string;
  
  // Tomador (Cliente)
  takerName: string;
  takerCNPJ: string;
  takerAddress: string;
  takerCity: string;
  takerState: string;
  takerCEP: string;
  takerPhone?: string;
  takerEmail?: string;
  
  // Serviço
  serviceCode: string;
  serviceDescription: string;
  
  // Valores
  serviceValue: number;
  deductions: number;
  irrf: number;
  pis: number;
  cofins: number;
  csll: number;
  issqn: number;
  totalTaxes: number;
  netValue: number;
  
  // Metadados
  filename: string;
  extractionConfidence: number; // 0-1
  extractionErrors?: string[];
}
```

---

## Dependências Necessárias
- `pdfjs-dist`: Extração de texto de PDFs
- `xlsx`: Leitura de Excel
- `react-dropzone`: Upload drag-drop
- `lucide-react`: Ícones (já incluído)
- `sonner`: Notificações (já incluído)

---

## Componentes React

### 1. **InvoiceProcessor** (Componente Principal)
- Gerencia estado global do processamento
- Orquestra upload de Excel e PDFs
- Exibe resultados em tabela

### 2. **ExcelUpload**
- Upload da planilha de referência
- Validação de formato
- Preview dos dados

### 3. **PDFUpload**
- Drag-drop para múltiplos PDFs
- Processamento em paralelo
- Barra de progresso

### 4. **ResultsTable**
- Exibe dados extraídos
- Permite edição manual
- Exportação (CSV/JSON/Excel)

### 5. **ExtractionSettings**
- Configuração de padrões regex
- Opções de validação
- Mapeamento de campos customizado

---

## Padrões Regex Iniciais

```typescript
const patterns = {
  nfsNumber: /Número da NFS-e\s+(\d+)/i,
  accessKey: /Chave de Acesso da NFS-e\s+([\d\s]+)/i,
  emissionDate: /Data e Hora de emissão da NFS-e\s+(\d{2}\/\d{2}\/\d{4})/i,
  serviceValue: /Valor do Serviço\s+R\$\s+([\d.,]+)/i,
  netValue: /Valor Líquido da NFS-e\s+R\$\s+([\d.,]+)/i,
  issuerCNPJ: /CNPJ.*?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i,
  takerCNPJ: /TOMADOR DO SERVIÇO.*?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/is,
};
```

---

## Próximos Passos
1. Instalar dependências (pdfjs-dist, xlsx)
2. Implementar hooks customizados para extração
3. Criar componentes React
4. Testar com PDF fornecido
5. Refinar padrões regex conforme necessário
