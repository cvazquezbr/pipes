/**
 * Padrões regex para extração de campos da NFS-e
 * Otimizados para DANFSe (Documento Auxiliar da NFS-e)
 * Após normalização de espaçamento
 */

export const EXTRACTION_PATTERNS_V1 = {
  // Identificação
  nfsNumber: /Número da NFS-e[\s\S]+?(\d+)(?=[\s\n]|$)/,
  accessKey: /Chave de Acesso da NFS-e[\s\n]+(\d+)/,
  seriesNumber: /Série da DPS[\s\S]+?(\d+)(?=[\s\n]|$)/,
  emissionDate: /Data e Hora da emissão da NFS-e[\s\S]+?(\d{2}\/\d{2}\/\d{4})/,
  emissionTime:
    /Data e Hora da emissão da NFS-e[\s\S]+?\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2}:\d{2})/,

  // Emitente
  issuerName:
    /EMITENTE DA NFS-e[\s\S]*?Nome \/ Nome Empresarial[\s\S]+?([^\n]+?)(?=\n|E-mail)/,
  issuerCNPJ:
    /EMITENTE DA NFS-e[\s\S]*?CNPJ \/ CPF \/ NIF[\s\S]+?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/,
  issuerAddress:
    /EMITENTE DA NFS-e[\s\S]*?Endereço[\s\S]+?([^\n]+?)(?=\n|Município)/,
  issuerCity:
    /EMITENTE DA NFS-e[\s\S]*?Município[\s\S]+?([^\n-]+?)\s*-\s*[A-Z]{2}/,
  issuerState: /EMITENTE DA NFS-e[\s\S]*?Município[\s\S]+?-\s*([A-Z]{2})/,
  issuerCEP: /EMITENTE DA NFS-e[\s\S]*?CEP[\s\S]+?(\d{5}-\d{3})/,
  issuerPhone:
    /Telefone[\s\S]+?(\([\d\s]+\)[\d\s-]+?)(?=\n|Nome|E-mail|Endereço)/,
  issuerEmail:
    /EMITENTE DA NFS-e[\s\S]*?E-mail[\s\S]+?([^\n]+?)(?=\n|Endereço)/,

  // Tomador
  takerName:
    /TOMADOR DO SERVIÇO[\s\S]*?Nome \/ Nome Empresarial[\s\S]+?([^\n]+?)(?=\n|E-mail)/,
  takerCNPJ:
    /TOMADOR DO SERVIÇO[\s\S]*?CNPJ \/ CPF \/ NIF[\s\S]+?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/,
  takerAddress:
    /TOMADOR DO SERVIÇO[\s\S]*?Endereço[\s\S]+?([^\n]+?)(?=\n|Município)/,
  takerCity:
    /TOMADOR DO SERVIÇO[\s\S]*?Município[\s\S]+?([^\n-]+?)\s*-\s*[A-Z]{2}/,
  takerState: /TOMADOR DO SERVIÇO[\s\S]*?Município[\s\S]+?-\s*([A-Z]{2})/,
  takerCEP: /TOMADOR DO SERVIÇO[\s\S]*?CEP[\s\S]+?(\d{5}-\d{3})/,

  // Serviço
  serviceCode:
    /Código de Tributação Nacional[\s\S]+?([^\n]+?)(?=\n|Código de Tributação Municipal)/,
  serviceDescription:
    /Descrição do Serviço[\s\S]+?([\s\S]+?)(?=TRIBUTAÇÃO MUNICIPAL)/,

  // Valores
  serviceValue: /Valor do Serviço[\s\S]{1,50}?(?:R\$\s+)?([\d.,]+|-)/,
  deductions: /Total Deduções\/Reduções[\s\S]{1,50}?(?:R\$\s+)?([\d.,]+|-)/,
  irrf: /TRIBUTAÇÃO FEDERAL[\s\S]+?(?:R\$\s+)?([\d.,]+|-)/,
  cp: /TRIBUTAÇÃO FEDERAL[\s\S]+?(?:(?:R\$\s+)?(?:[\d.,]+|-))[\s\S]+?(?:R\$\s+)?([\d.,]+|-)/,
  csll: /TRIBUTAÇÃO FEDERAL[\s\S]+?(?:(?:R\$\s+)?(?:[\d.,]+|-))[\s\S]+?(?:(?:R\$\s+)?(?:[\d.,]+|-))[\s\S]+?(?:R\$\s+)?([\d.,]+|-)/,
  pis: /TRIBUTAÇÃO FEDERAL[\s\S]+?(?:(?:R\$\s+)?(?:[\d.,]+|-))[\s\S]+?(?:(?:R\$\s+)?(?:[\d.,]+|-))[\s\S]+?(?:(?:R\$\s+)?(?:[\d.,]+|-))[\s\S]+?(?:R\$\s+)?([\d.,]+|-)/,
  cofins:
    /TRIBUTAÇÃO FEDERAL[\s\S]+?(?:(?:R\$\s+)?(?:[\d.,]+|-))[\s\S]+?(?:(?:R\$\s+)?(?:[\d.,]+|-))[\s\S]+?(?:(?:R\$\s+)?(?:[\d.,]+|-))[\s\S]+?(?:(?:R\$\s+)?(?:[\d.,]+|-))[\s\S]+?(?:R\$\s+)?([\d.,]+|-)/,
  pisCofinsRetention:
    /TRIBUTAÇÃO FEDERAL[\s\S]+?(Retido|Não Retido|-)(?=\s+(?:(?:R\$\s+)?[\d.,]+|-)?\s*(?:VALOR TOTAL|TOTAL TRIBUTAÇÃO))/,

  // ISSQN - Campos detalhados
  issqnBase: /BC ISSQN[\s\S]{1,50}?(?:R\$\s+)?([\d.,]+|-)/,
  issqnApurado: /ISSQN Apurado[\s\S]{1,50}?(?:R\$\s+)?([\d.,]+|-)/,
  issqnAliquota: /Alíquota Aplicada[\s\S]+?(\d+[.,]\d{2}%)/,
  issqnSuspensao:
    /Suspensão da Exigibilidade do ISSQN[\s\S]+?(Sim|Não)(?=\s|\n)/,
  issqnMunicipio:
    /Município de Incidência do ISSQN[\s\S]+?([^\n-]+?)\s*-\s*([A-Z]{2})(?=\s|\n)/,
  issqnTributacao:
    /Tributação do ISSQN[\s\S]+?(Tributável|Não Tributável|Imune)(?=\s|\n)/,
  issqnRetido: /ISSQN Retido[\s\S]{1,50}?(?:R\$\s+)?([\d.,]+|-)/,

  netValue: /Valor Líquido da NFS-e[\s\S]{1,50}?(?:R\$\s+)?([\d.,]+|-)/,

  // Cancelamento
  cancellation:
    /Regime\s*Especial\s*de\s*Tributação[\s\S]+?(CANCELADA)[\s\S]+?Suspensão\s*da\s*Exigibilidade/i,
};

export const EXTRACTION_PATTERNS_V2 = {
  // Identificação
  nfsNumber: /NÚMERO DA NFS-e\s+(\d+)/i,
  accessKey: /CHAVE DE ACESSO DA NFS-e\s+(\d+)/i,
  seriesNumber: /SÉRIE DA DPS\s+(\d+)/i,
  emissionDate: /DATA E HORA DA EMISSÃO DA NFS-e\s+(\d{2}\/\d{2}\/\d{4})/i,
  emissionTime: /DATA E HORA DA EMISSÃO DA NFS-e\s+\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2}:\d{2})/i,

  // Emitente (PRESTADOR / FORNECEDOR)
  issuerName: /PRESTADOR \/ FORNECEDOR[\s\S]*?Nome \/ Nome Empresarial\s+([^\n]+?)\s+(?:Município \/ Sigla UF|E-mail)/i,
  issuerCNPJ: /PRESTADOR \/ FORNECEDOR[\s\S]*?CNPJ \/ CPF \/ NIF\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i,
  issuerAddress: /PRESTADOR \/ FORNECEDOR[\s\S]*?Endereço\s+([^\n]+?)\s+E-mail/i,
  issuerCity: /PRESTADOR \/ FORNECEDOR[\s\S]*?Município \/ Sigla UF\s+([^\n\/]+?)\s*\//i,
  issuerState: /PRESTADOR \/ FORNECEDOR[\s\S]*?Município \/ Sigla UF\s+[^\n\/]+?\s*\/\s*([A-Z]{2})/i,
  issuerCEP: /PRESTADOR \/ FORNECEDOR[\s\S]*?Código IBGE \/ CEP[\s\S]+?(\d{2}\.\d{3}-\d{3})/i,
  issuerPhone: /PRESTADOR \/ FORNECEDOR[\s\S]*?Telefone\s+(\([\d\s]+\)[\d\s-]+?|-)(?=\s+Nome|\s+E-mail|\s+Endereço)/i,
  issuerEmail: /PRESTADOR \/ FORNECEDOR[\s\S]*?E-mail\s+([^\s]+?)\s+Simples/i,

  // Tomador (TOMADOR / ADQUIRENTE)
  takerName: /TOMADOR \/ ADQUIRENTE[\s\S]*?Nome \/ Nome Empresarial\s+([^\n]+?)\s+(?:Município \/ Sigla UF|E-mail)/i,
  takerCNPJ: /TOMADOR \/ ADQUIRENTE[\s\S]*?CNPJ \/ CPF \/ NIF\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i,
  takerAddress: /TOMADOR \/ ADQUIRENTE[\s\S]*?Endereço\s+([^\n]+?)\s+E-mail/i,
  takerCity: /TOMADOR \/ ADQUIRENTE[\s\S]*?Município \/ Sigla UF\s+([^\n\/]+?)\s*\//i,
  takerState: /TOMADOR \/ ADQUIRENTE[\s\S]*?Município \/ Sigla UF\s+[^\n\/]+?\s*\/\s*([A-Z]{2})/i,
  takerCEP: /TOMADOR \/ ADQUIRENTE[\s\S]*?Código IBGE \/ CEP[\s\S]+?(\d{2}\.\d{3}-\d{3})/i,

  // Serviço
  serviceCode: /Código de Tributação Nacional\/Municipal\s+([^\s]+?)\s*\//i,
  serviceDescription: /Descrição do Serviço\s+([\s\S]+?)(?=\s*TRIBUTAÇÃO MUNICIPAL)/i,

  // Valores
  serviceValue: /VALOR DA OPERAÇÃO \/ SERVIÇO[\s\S]{1,50}?(?:R\$\s+)?([\d.,]+|-)/i,
  deductions: /Total Deduções\/Reduções[\s\S]{1,50}?(?:R\$\s+)?([\d.,]+|-)/i,

  // Federal Taxes (Explicit labels, robust across layouts)
  irrf: /IRRF\s+(?:R\$\s+)?([\d.,]+|-)/i,
  cp: /Contribuição Previdenciária - Retida\s+(?:R\$\s+)?([\d.,]+|-)/i,
  csll: /Contribuições Sociais - Retidas\s+(?:R\$\s+)?([\d.,]+|-)/i,
  pis: /PIS - Débito Apuração Própria\s+(?:R\$\s+)?([\d.,]+|-)/i,
  cofins: /COFINS - Débito Apuração Própria\s+(?:R\$\s+)?([\d.,]+|-)/i,
  pisCofinsRetention: /Descrição Contrib\. Sociais - Retidas\s+\d+\s*-\s*PIS\/COFINS\/CSLL\s+(Retidos|Não Retidos)/i,

  // ISSQN - Campos detalhados
  issqnBase: /BC ISSQN[\s\S]{1,50}?(?:R\$\s+)?([\d.,]+|-)/i,
  issqnApurado: /ISSQN Apurado[\s\S]{1,50}?(?:R\$\s+)?([\d.,]+|-)/i,
  issqnAliquota: /Alíquota Aplicada\s+(\d+[.,]\d{2}\s*%)/i,
  issqnSuspensao: /Suspensão da Exigibilidade do ISSQN[\s\S]+?(Sim|Não)(?=\s|\n)/i,
  issqnMunicipio: /Município \/ Sigla UF \/ País de Incidência do ISSQN\s+([^\n\/]+?)\s*\/\s*([A-Z]{2})/i,
  issqnTributacao: /Tipo de Tributação do ISSQN\s+(Operação Tributável|Tributável|Não Tributável|Imune)/i,
  issqnRetidoText: /Retenção do ISSQN\s+(Retido|Não Retido)/i,

  netValue: /VALOR LÍQUIDO DA NFS-e[\s\S]{1,50}?(?:R\$\s+)?([\d.,]+|-)/i,

  // IBS / CBS Fields
  ibsCbsCst: /CST \/ cClassTrib\s+([^\n]+?)\s+Indicador de Operação/i,
  ibsCbsBaseAposReducoes: /Base de Cálculo Após Exclusões e Reduções\s+(?:R\$\s+)?([\d.,]+|-)/i,
  ibsAliquotaEfetivaMunicipal: /Alíq\. Efetiva Municipal - IBS\s+([^\s]+)/i,
  ibsValorApuradoMunicipal: /Valor Apurado Municipal - IBS\s+(?:R\$\s+)?([\d.,]+|-)/i,
  ibsAliquotaEfetivaEstadual: /Alíq\. Efetiva Estadual - IBS\s+([^\s]+)/i,
  ibsValorApuradoEstadual: /Valor Apurado Estadual - IBS\s+(?:R\$\s+)?([\d.,]+|-)/i,
  ibsValorTotalApurado: /Valor Total Apurado - IBS\s+(?:R\$\s+)?([\d.,]+|-)/i,
  cbsAliquota: /Alíquota - CBS\s+([^\s]+)/i,
  cbsValorTotalApurado: /Valor Total Apurado - CBS\s+(?:R\$\s+)?([\d.,]+|-)/i,
  totalIbsCbs: /Total do IBS\/CBS\s+(?:R\$\s+)?([\d.,]+|-)/i,
  netValueWithIbsCbs: /VALOR LÍQUIDO DA NFS-e \+ IBS\/CBS\s+(?:R\$\s+)?([\d.,]+|-)/i,

  // Cancelamento
  cancellation: /SITUAÇÃO DA NFS-e\s+(NFS-e Cancelada|Cancelada)/i,
};

export const EXTRACTION_PATTERNS = EXTRACTION_PATTERNS_V1;

export function getExtractionPatterns(version: "v1" | "v2") {
  return version === "v2" ? EXTRACTION_PATTERNS_V2 : EXTRACTION_PATTERNS_V1;
}
