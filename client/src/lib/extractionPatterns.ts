/**
 * Padrões regex para extração de campos da NFS-e
 * Otimizados para DANFSe (Documento Auxiliar da NFS-e)
 * Após normalização de espaçamento
 */
export const EXTRACTION_PATTERNS = {
  // Identificação
  nfsNumber: /Número da NFS-e[\s\S]+?(\d+)(?=[\s\n]|$)/,
  seriesNumber: /Série da DPS[\s\S]+?(\d+)(?=[\s\n]|$)/,
  emissionDate: /Data e Hora da emissão da NFS-e[\s\S]+?(\d{2}\/\d{2}\/\d{4})/,
  emissionTime: /Data e Hora da emissão da NFS-e[\s\S]+?\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2}:\d{2})/,

  // Emitente
  issuerName: /EMITENTE DA NFS-e[\s\S]*?Nome \/ Nome Empresarial[\s\S]+?([^\n]+?)(?=\n|E-mail)/,
  issuerCNPJ: /EMITENTE DA NFS-e[\s\S]*?CNPJ \/ CPF \/ NIF[\s\S]+?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/,
  issuerAddress: /EMITENTE DA NFS-e[\s\S]*?Endereço[\s\S]+?([^\n]+?)(?=\n|Município)/,
  issuerCity: /EMITENTE DA NFS-e[\s\S]*?Município[\s\S]+?([^\n-]+?)\s*-\s*[A-Z]{2}/,
  issuerState: /EMITENTE DA NFS-e[\s\S]*?Município[\s\S]+?-\s*([A-Z]{2})/,
  issuerCEP: /EMITENTE DA NFS-e[\s\S]*?CEP[\s\S]+?(\d{5}-\d{3})/,
  issuerPhone: /Telefone[\s\S]+?(\([\d\s]+\)[\d\s-]+?)(?=\n|Nome|E-mail|Endereço)/,
  issuerEmail: /EMITENTE DA NFS-e[\s\S]*?E-mail[\s\S]+?([^\n]+?)(?=\n|Endereco)/,

  // Tomador
  takerName: /TOMADOR DO SERVIÇO[\s\S]*?Nome \/ Nome Empresarial[\s\S]+?([^\n]+?)(?=\n|E-mail)/,
  takerCNPJ: /TOMADOR DO SERVIÇO[\s\S]*?CNPJ \/ CPF \/ NIF[\s\S]+?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/,
  takerAddress: /TOMADOR DO SERVIÇO[\s\S]*?Endereço[\s\S]+?([^\n]+?)(?=\n|Município)/,
  takerCity: /TOMADOR DO SERVIÇO[\s\S]*?Município[\s\S]+?([^\n-]+?)\s*-\s*[A-Z]{2}/,
  takerState: /TOMADOR DO SERVIÇO[\s\S]*?Município[\s\S]+?-\s*([A-Z]{2})/,
  takerCEP: /TOMADOR DO SERVIÇO[\s\S]*?CEP[\s\S]+?(\d{5}-\d{3})/,

  // Serviço
  serviceCode: /Código de Tributação Nacional[\s\S]+?([^\n]+?)(?=\n|Código de Tributação Municipal)/,
  serviceDescription: /Descrição do Serviço[\s\S]+?([\s\S]+?)(?=TRIBUTAÇÃO MUNICIPAL)/,

  // Valores
  serviceValue: /Valor do Serviço[\s\S]+?R\$\s+([\d.,]+)/,
  deductions: /Total Deduções\/Reduções[\s\S]+?R\$\s+([\d.,]+)(?=\s|\n)/,
  irrf: /IRRF[\s\S]+?R\$\s+([\d.,]+)/,
  pis: /PIS[\s\S]+?R\$\s+([\d.,]+)/,
  cofins: /COFINS[\s\S]+?R\$\s+([\d.,]+)/,
  csll: /CSLL[\s\S]+?R\$\s+([\d.,]+)/,

  // ISSQN - Campos detalhados
  issqnBase: /Base de Cálculo do ISSQN[\s\S]+?R\$\s+([\d.,]+)/,
  issqnApurado: /ISSQN Apurado[\s\S]+?R\$\s+([\d.,]+)/,
  issqnAliquota: /Alíquota Aplicada[\s\S]+?(\d+[.,]\d{2}%)/,
  issqnSuspensao: /Suspensão da Exigibilidade do ISSQN[\s\S]+?(Sim|Não)(?=\s|\n)/,
  issqnMunicipio: /Município de Incidência do ISSQN[\s\S]+?([^\n-]+?)\s*-\s*([A-Z]{2})(?=\s|\n)/,
  issqnTributacao: /Tributação do ISSQN[\s\S]+?(Tributável|Não Tributável|Imune)(?=\s|\n)/,
  issqnCP: /Retenção do ISSQN[\s\S]+?(?:Retido pelo Tomador)?[\s\S]+?R\$\s+([\d.,]+)/,
  issqnRetido: /ISSQN Retido[\s\S]+?R\$\s+([\d.,]+)/,

  netValue: /Valor Líquido da NFS-e[\s\S]+?R\$\s+([\d.,]+)/,
};
