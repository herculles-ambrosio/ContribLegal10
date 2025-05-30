import * as cheerio from 'cheerio';

// Constantes para depuração
const DEBUG = true;  // Habilitar logs para diagnóstico
const REDUCED_TIMEOUT = true;  // Usar timeout reduzido para melhorar experiência do usuário

export interface FiscalReceiptData {
  numeroDocumento?: string;
  valor?: string;
  dataEmissao?: string;
  error?: string;
}

/**
 * Serviço para extrair dados de cupom fiscal da SEFAZ MG a partir do link do QR Code
 * @param qrCodeLink Link do QR Code do cupom fiscal
 * @param apiBaseUrl URL base da API (opcional, usado quando acessado de fora)
 */
export async function extractDataFromFiscalReceipt(
  qrCodeLink: string, 
  apiBaseUrl?: string
): Promise<FiscalReceiptData> {
  try {
    // IMPORTANTE: Logs iniciais detalhados
    if (DEBUG) console.log('🔍 [INICIO EXTRACAO] Link recebido:', qrCodeLink);
    
    // Normalizar URL - remover espaços e caracteres estranhos
    const normalizedLink = qrCodeLink.trim();
    if (DEBUG) console.log('🔍 Link normalizado:', normalizedLink);
    
    // Determinar a URL da API baseado no ambiente
    const apiUrl = apiBaseUrl 
      ? `${apiBaseUrl}/api/fiscal-receipt` 
      : '/api/fiscal-receipt';

    if (DEBUG) console.log('🔍 URL da API:', apiUrl);

    // Fazer requisição para nossa API com timeout reduzido
    const controller = new AbortController();
    const timeoutDuration = REDUCED_TIMEOUT ? 5000 : 12000; // 5 ou 12 segundos
    const timeoutId = setTimeout(() => {
      if (DEBUG) console.log('⚠️ TIMEOUT ACIONADO! Abortando requisição após', timeoutDuration/1000, 'segundos');
      controller.abort();
    }, timeoutDuration);
    
    // CRUCIAL: Garantir que o link é preservado como numeroDocumento
    // independentemente do que acontecer durante a extração
    const linkCompleto = normalizedLink;
    if (DEBUG) console.log('🔒 Link preservado como numeroDocumento:', linkCompleto);
    
    // Se não for uma URL completa, tentar adicionar o protocolo
    let urlProcessada = normalizedLink;
    if (!urlProcessada.startsWith('http://') && !urlProcessada.startsWith('https://')) {
      urlProcessada = `https://${urlProcessada}`;
      if (DEBUG) console.log('🔍 URL modificada com protocolo https:', urlProcessada);
    }

    // Criar um objeto para armazenar os resultados parciais 
    // que serão atualizados pelas extrações paralelas
    const resultadoParcial: FiscalReceiptData = {
      numeroDocumento: linkCompleto, // Garantir que o link original está aqui
      valor: undefined,
      dataEmissao: undefined
    };
    
    // Processar dados em paralelo para otimização
    // Inicializa todas as tarefas ao mesmo tempo, mas usa um timeout mais curto
    try {
      // Executar as extrações em paralelo para economizar tempo
      const [extraidoDaUrl, extraidoDaApi] = await Promise.allSettled([
        // 1. Extração direta da URL (mais rápido, mas menos preciso)
        extrairDadosDiretamente(urlProcessada, DEBUG),
        
        // 2. Chamada à API (mais preciso, mas mais lento)
        (async () => {
          try {
            // Usar um timeout menor para a chamada da API
            const apiController = new AbortController();
            const apiTimeoutId = setTimeout(() => apiController.abort(), 8000); // 8 segundos máximo
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                qrCodeLink: urlProcessada,
                preExtractedValor: resultadoParcial.valor, 
                preExtractedData: resultadoParcial.dataEmissao,
                originalLinkPreserve: linkCompleto // ADICIONAR LINK ORIGINAL PARA PRESERVAR NA API
              }),
              signal: apiController.signal,
            });
            
            clearTimeout(apiTimeoutId);
            
            if (!response.ok) {
              throw new Error(`Erro na API: ${response.status}`);
            }
            
            return await response.json();
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              throw new Error('Timeout ao chamar API');
            }
            throw error;
          }
        })()
      ]);
      
      // Limpar timeout principal
      clearTimeout(timeoutId);
      
      // Processar resultados da extração direta da URL
      if (extraidoDaUrl.status === 'fulfilled' && extraidoDaUrl.value) {
        // Atualizar valores do resultado parcial se tiverem sido obtidos
        if (extraidoDaUrl.value.valor) resultadoParcial.valor = extraidoDaUrl.value.valor;
        if (extraidoDaUrl.value.dataEmissao) resultadoParcial.dataEmissao = extraidoDaUrl.value.dataEmissao;
        
        // Log para verificar os dados extraídos diretamente
        if (DEBUG) console.log('✅ [EXTRACAO DIRETA] Dados extraídos da URL:', extraidoDaUrl.value);
      }
      
      // Processar resultados da API (têm prioridade sobre a extração direta)
      if (extraidoDaApi.status === 'fulfilled' && extraidoDaApi.value) {
        const dadosApi = extraidoDaApi.value;
        
        // Valores da API têm preferência se disponíveis
        if (dadosApi.valor) {
          resultadoParcial.valor = formatarValor(dadosApi.valor);
        } 
        
        if (dadosApi.dataEmissao) {
          resultadoParcial.dataEmissao = formatarData(dadosApi.dataEmissao);
        }
        
        // Log para verificar os dados extraídos pela API
        if (DEBUG) console.log('✅ [EXTRACAO API] Dados extraídos pela API:', dadosApi);
      }
      
      // Se ainda não temos valor ou data, usar valores padrão
      if (!resultadoParcial.valor) {
        resultadoParcial.valor = '0,00';
      }
      
      if (!resultadoParcial.dataEmissao) {
        // Usar data atual como fallback
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
        resultadoParcial.dataEmissao = `${dia}/${mes}/${ano}`;
      }
      
      // VERIFICAÇÃO FINAL: Garantir que o número do documento é o link original
      resultadoParcial.numeroDocumento = linkCompleto;
      
      if (DEBUG) console.log('✅ [FIM EXTRACAO] Dados finais retornados:', resultadoParcial);
      return resultadoParcial;
      
    } catch (error) {
      // Limpar timeout em caso de erro
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('⏱️ TIMEOUT: A requisição para a API excedeu o tempo limite.');
        // Retornar os dados parciais já extraídos
        return {
          error: 'A requisição excedeu o tempo limite.',
          numeroDocumento: linkCompleto, // GARANTIR QUE É O LINK COMPLETO
          valor: resultadoParcial.valor || '0,00',
          dataEmissao: resultadoParcial.dataEmissao || obterDataAtual()
        };
      }
      
      console.error('❌ Erro durante a extração de dados:', error);
      return {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        numeroDocumento: linkCompleto, // GARANTIR QUE É O LINK COMPLETO
        valor: resultadoParcial.valor || '0,00',
        dataEmissao: resultadoParcial.dataEmissao || obterDataAtual()
      };
    }
  } catch (generalError) {
    console.error('❌ Erro geral na extração:', generalError);
    return {
      error: generalError instanceof Error ? generalError.message : 'Erro desconhecido',
      numeroDocumento: qrCodeLink, // ORIGINAL LINK
      valor: '0,00',
      dataEmissao: obterDataAtual()
    };
  }
}

/**
 * Função otimizada para extrair dados diretamente da URL do QR code
 * sem depender da API para melhorar a velocidade
 */
async function extrairDadosDiretamente(url: string, debug = false): Promise<FiscalReceiptData> {
  const resultado: FiscalReceiptData = {
    numeroDocumento: url,
  };
  
  try {
    // 1. Tentar extrair dados da própria URL através de parâmetros
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      // Tentar extrair valor com padrões expandidos
      const possiveisValores = [
        params.get('vNF'),
        params.get('valor'),
        params.get('valorTotal'),
        params.get('total'),
        params.get('vPag'),
        params.get('VNF'),
        params.get('VALOR'),
        params.get('price'),
        params.get('amount'),
        params.get('amt')
      ];
      
      for (const val of possiveisValores) {
        if (val && !isNaN(parseFloat(val.replace(',', '.')))) {
          resultado.valor = formatarValor(val);
          if (debug) console.log(`🔍 [URL] Valor extraído do parâmetro: ${resultado.valor}`);
          break;
        }
      }
      
      // Tentar extrair data com padrões expandidos
      const possiveisDatas = [
        params.get('dhEmi'),
        params.get('data'),
        params.get('dataEmissao'),
        params.get('dEmi'),
        params.get('DATA'),
        params.get('date'),
        params.get('dt'),
        params.get('emissao'),
        params.get('EMISSAO')
      ];
      
      for (const data of possiveisDatas) {
        if (data && /\d{2}[\/\.-]\d{2}[\/\.-]\d{4}|\d{4}[\/\.-]\d{2}[\/\.-]\d{2}/.test(data)) {
          resultado.dataEmissao = formatarData(data);
          if (debug) console.log(`🔍 [URL] Data extraída do parâmetro: ${resultado.dataEmissao}`);
          break;
        }
      }
    } catch (linkError) {
      // Ignora erros na análise da URL
      if (debug) console.log('⚠️ [URL] Erro ao analisar parâmetros da URL:', linkError);
    }
    
    // 2. Tentar acessar a página rapidamente para extração direta com timeout aumentado (5s)
    if (!resultado.valor || !resultado.dataEmissao) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const text = await response.text();
          
          // Extrair valor usando regex expandidos
          if (!resultado.valor) {
            const valorPatterns = [
              /(?:Valor Total|Total|Valor)(?:\s*R\$)?[\s:]*([0-9]+[,.][0-9]{2})/i,
              /(?:R\$\s*)([0-9]+[,.][0-9]{2})/i,
              /(?:VALOR\s*TOTAL\s*R\$\s*)([0-9]+[,.][0-9]{2})/i,
              /(?:TOTAL\s*R\$\s*)([0-9]+[,.][0-9]{2})/i,
              /(?:TOTAL:?\s*)([0-9]+[,.][0-9]{2})/i,
              /(?:VALOR:?\s*)([0-9]+[,.][0-9]{2})/i
            ];
            
            for (const pattern of valorPatterns) {
              const valorMatches = text.match(pattern);
              if (valorMatches && valorMatches[1]) {
                resultado.valor = formatarValor(valorMatches[1]);
                if (debug) console.log(`🔍 [HTML] Valor extraído com regex: ${resultado.valor}`);
                break;
              }
            }
          }
          
          // Extrair data usando regex expandidos
          if (!resultado.dataEmissao) {
            const dataPatterns = [
              /(?:Data(?:\s*de)?\s*Emissão|Emissão)(?:\s*:)?\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
              /(?:DATA\s*EMISSÃO:?\s*)([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
              /(?:EMISSÃO:?\s*)([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
              /(?:DATA:?\s*)([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
              /(?:EMI:?\s*)([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
              /([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i
            ];
            
            for (const pattern of dataPatterns) {
              const dataMatches = text.match(pattern);
              if (dataMatches && dataMatches[1]) {
                resultado.dataEmissao = dataMatches[1];
                if (debug) console.log(`🔍 [HTML] Data extraída com regex: ${resultado.dataEmissao}`);
                break;
              }
            }
          }
          
          // Se ainda não tem data, buscar por outros formatos
          if (!resultado.dataEmissao) {
            const dataPatternsFallback = [
              /(?:Data(?:\s*de)?\s*Emissão|Emissão)(?:\s*:)?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
              /(?:DATA\s*EMISSÃO:?\s*)([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
              /(?:EMISSÃO:?\s*)([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
              /(?:DATA:?\s*)([0-9]{4}-[0-9]{2}-[0-9]{2})/i
            ];
            
            for (const pattern of dataPatternsFallback) {
              const dataMatches = text.match(pattern);
              if (dataMatches && dataMatches[1]) {
                resultado.dataEmissao = formatarData(dataMatches[1]);
                if (debug) console.log(`🔍 [HTML] Data extraída com regex alternativo: ${resultado.dataEmissao}`);
                break;
              }
            }
          }
        }
      } catch (preError) {
        if (debug) console.log('⚠️ [HTML] Erro ao acessar página:', preError);
        // Ignora erros na pré-extração direta
      }
    }
    
    return resultado;
  } catch (error) {
    if (debug) console.log('❌ [DIRETO] Erro na extração direta:', error);
    // Se ocorrer qualquer erro, retornar o que conseguimos até agora
    return resultado;
  }
}

/**
 * Formata um valor para o padrão brasileiro
 */
function formatarValor(valor: string): string {
  try {
    // Sanitizar valor
    let valorLimpo = valor.replace(/[^\d,\.]/g, '');
    
    // Substituir pontos por nada (assumindo separadores de milhar)
    valorLimpo = valorLimpo.replace(/\./g, '');
    
    // Substituir vírgula por ponto para operações numéricas
    valorLimpo = valorLimpo.replace(',', '.');
    
    // Converter para número
    const valorNumerico = parseFloat(valorLimpo);
    
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      return '0,00';
    }
    
    // Formatar valor para padrão brasileiro
    return valorNumerico.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch (e) {
    return '0,00';
  }
}

/**
 * Formata uma data para o padrão brasileiro
 */
function formatarData(data: string): string {
  try {
    const dataLimpa = data.trim();
    
    // Formato YYYY-MM-DD ou YYYY/MM/DD
    if (/^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(dataLimpa)) {
      const separador = dataLimpa.includes('-') ? '-' : '/';
      const [ano, mes, dia] = dataLimpa.split(separador);
      return `${dia}/${mes}/${ano}`;
    } 
    // Formato DD-MM-YYYY ou DD.MM.YYYY
    else if (/^\d{2}[-\.]\d{2}[-\.]\d{4}$/.test(dataLimpa)) {
      const partes = dataLimpa.split(/[-\.]/);
      return `${partes[0]}/${partes[1]}/${partes[2]}`;
    }
    // Formato timestamp (AAAAMMDD)
    else if (/^\d{8}$/.test(dataLimpa)) {
      const ano = dataLimpa.substring(0, 4);
      const mes = dataLimpa.substring(4, 6);
      const dia = dataLimpa.substring(6, 8);
      return `${dia}/${mes}/${ano}`;
    }
    
    // Se já estiver no formato DD/MM/YYYY, manter assim
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataLimpa)) {
      return dataLimpa;
    }
    
    // Se nenhum formato conhecido, usar data atual
    return obterDataAtual();
  } catch (e) {
    return obterDataAtual();
  }
}

/**
 * Retorna a data atual no formato brasileiro
 */
function obterDataAtual(): string {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  return `${dia}/${mes}/${ano}`;
} 