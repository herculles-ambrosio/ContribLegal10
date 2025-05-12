import * as cheerio from 'cheerio';

// Constantes para depuração
const DEBUG = true;  // Habilitar logs detalhados
const REDUCED_TIMEOUT = false;  // Se true, usa timeout reduzido para testes rápidos

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

    // Fazer requisição para nossa API com timeout aumentado
    // Timeout aumentado para 60 segundos (ou 10 segundos no modo teste)
    const controller = new AbortController();
    const timeoutDuration = REDUCED_TIMEOUT ? 10000 : 60000; // 10 ou 60 segundos
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

    try {
      // NOVA ABORDAGEM: Pré-processamento agressivo para extrair dados diretamente da URL
      // antes mesmo de fazer qualquer requisição
      if (DEBUG) console.log('🔍 Iniciando pré-extração direta do link...');
      let preValor: string | undefined = undefined;
      let preData: string | undefined = undefined;
      
      // 1. Tentar acessar a URL em modo text-only para extração rápida
      try {
        if (DEBUG) console.log('🌐 Tentando acessar a URL diretamente:', urlProcessada);
        
        // Requisição preliminar com timeout reduzido
        const preController = new AbortController();
        const preTimeoutId = setTimeout(() => preController.abort(), 5000); // 5 segundos apenas
        
        const preResponse = await fetch(urlProcessada, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          signal: preController.signal,
        });
        
        clearTimeout(preTimeoutId);
        
        if (preResponse.ok) {
          const text = await preResponse.text();
          if (DEBUG) console.log('🌐 Pré-resposta OK. Tamanho do texto:', text.length, 'bytes');
          
          // Extrair valor usando regex agressivo
          const valorMatches = text.match(/(?:Valor Total|Total|Valor)(?:\s*R\$)?[\s:]*([0-9]+[,.][0-9]{2})/i) ||
                               text.match(/(?:R\$)\s*([0-9]+[,.][0-9]{2})/i) ||
                               text.match(/([0-9]+,[0-9]{2})/);
          
          if (valorMatches && valorMatches[1]) {
            preValor = valorMatches[1].replace('.', '').replace(',', '.');
            if (DEBUG) console.log('💰 Valor pré-extraído diretamente da página:', preValor);
          }
          
          // Extrair data usando regex agressivo
          const dataMatches = text.match(/(?:Data(?:\s*de)?\s*Emissão|Emissão)(?:\s*:)?\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) ||
                              text.match(/([0-9]{2}\/[0-9]{2}\/[0-9]{4})/);
          
          if (dataMatches && dataMatches[1]) {
            preData = dataMatches[1];
            if (DEBUG) console.log('📅 Data pré-extraída diretamente da página:', preData);
          }
        }
      } catch (preError) {
        if (DEBUG) console.log('⚠️ Erro na pré-extração direta:', preError);
        // Continuar mesmo com erro - isso é apenas uma tentativa extra
      }
      
      // 2. Tentar extrair da URL (busca-se nos parâmetros de query)
      try {
        const urlObj = new URL(urlProcessada);
        const params = new URLSearchParams(urlObj.search);
        
        // Tentar extrair valor de parâmetros comuns
        const possiveisValores = [
          params.get('vNF'),
          params.get('valor'),
          params.get('valorTotal'),
          params.get('total'),
          params.get('vPag')
        ];
        
        for (const val of possiveisValores) {
          if (val && !isNaN(parseFloat(val.replace(',', '.')))) {
            if (!preValor) { // Só substitui se não tiver extraído antes
              preValor = val.replace(',', '.');
              if (DEBUG) console.log('💰 Valor pré-extraído dos parâmetros URL:', preValor);
            }
            break;
          }
        }
        
        // Tentar extrair data de parâmetros comuns
        const possiveisDatas = [
          params.get('dhEmi'),
          params.get('data'),
          params.get('dataEmissao'),
          params.get('dEmi')
        ];
        
        for (const data of possiveisDatas) {
          if (data && data.match(/\d{2}[\/\.-]\d{2}[\/\.-]\d{4}|\d{4}[\/\.-]\d{2}[\/\.-]\d{2}/)) {
            if (!preData) { // Só substitui se não tiver extraído antes
              preData = data;
              if (DEBUG) console.log('📅 Data pré-extraída dos parâmetros URL:', preData);
            }
            break;
          }
        }
      } catch (linkError) {
        if (DEBUG) console.warn('⚠️ Erro ao tentar extrair dados dos parâmetros da URL:', linkError);
      }

      // Fazer requisição para a API principal
      if (DEBUG) console.log('🌐 Enviando requisição para API principal...');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          qrCodeLink: urlProcessada,
          preExtractedValor: preValor,  
          preExtractedData: preData
        }),
        signal: controller.signal,
      });

      // Limpar timeout
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (DEBUG) console.error('❌ Erro na API:', response.status);
        
        // ABORDAGEM ROBUSTA: Se a API falhar mas temos dados pré-extraídos, usamos esses
        if (preValor || preData) {
          if (DEBUG) console.log('🛟 Usando dados pré-extraídos devido a falha na API');
          const fallbackResult = {
            numeroDocumento: linkCompleto, // CRUCIAL: O link completo é o número do documento
            valor: preValor,
            dataEmissao: preData
          };
          
          return fallbackResult;
        }
        
        // Mesmo se não tiver outros dados, garantimos que o número do documento está preenchido
        return {
          error: `Erro ao acessar a API: ${response.status}`,
          numeroDocumento: linkCompleto // CRUCIAL: Sempre retornar o link como número do documento
        };
      }

      const data = await response.json();
      if (DEBUG) console.log('✅ Dados recebidos da API:', data);
      
      // AQUI ESTÁ A CORREÇÃO PRINCIPAL:
      // Iniciar com o link completo como número do documento
      // independente do que a API retornou
      const result: FiscalReceiptData = {
        numeroDocumento: linkCompleto, // CRUCIAL: Sempre garantir que é o link original, não o que a API retornou
        valor: data.valor,
        dataEmissao: data.dataEmissao,
      };

      if (DEBUG) console.log('🔍 Iniciando validação e formatação dos dados recebidos...');

      // Processamento adicional para garantir a validade do valor
      if (result.valor) {
        try {
          // Tratar valores numéricos inválidos
          let valorProcessado = result.valor;
          
          // Remover caracteres não numéricos, exceto vírgula e ponto
          valorProcessado = valorProcessado.replace(/[^\d,\.]/g, '');
          
          // Substituir pontos por nada (assumindo que são separadores de milhar)
          valorProcessado = valorProcessado.replace(/\./g, '');
          
          // Substituir vírgula por ponto para operações numéricas
          valorProcessado = valorProcessado.replace(',', '.');
          
          // Converter para número e verificar validade
          const valorNumerico = parseFloat(valorProcessado);
          
          if (isNaN(valorNumerico) || valorNumerico <= 0) {
            if (DEBUG) console.warn('⚠️ Valor inválido da API:', result.valor);
            
            // Se temos um valor pré-extraído, usar ele como fallback
            if (preValor && !isNaN(parseFloat(preValor))) {
              const valorPreNumerico = parseFloat(preValor);
              result.valor = valorPreNumerico.toFixed(2).replace('.', ',');
              if (DEBUG) console.log('💰 Usando valor pré-extraído como fallback:', result.valor);
            } else {
              result.valor = undefined;
            }
          } else {
            // Formatação para padrão brasileiro (com vírgula como separador decimal)
            result.valor = valorNumerico.toFixed(2).replace('.', ',');
            if (DEBUG) console.log('💰 Valor processado com sucesso:', result.valor);
          }
        } catch (e) {
          if (DEBUG) console.error('❌ Erro ao processar valor:', e);
          
          // Tentar usar valor pré-extraído em caso de erro
          if (preValor && !isNaN(parseFloat(preValor))) {
            const valorPreNumerico = parseFloat(preValor);
            result.valor = valorPreNumerico.toFixed(2).replace('.', ',');
            if (DEBUG) console.log('💰 Usando valor pré-extraído após erro:', result.valor);
          } else {
            result.valor = undefined;
          }
        }
      } else if (preValor && !isNaN(parseFloat(preValor))) {
        // Se a API não retornou valor mas temos um valor pré-extraído, usar ele
        const valorPreNumerico = parseFloat(preValor);
        result.valor = valorPreNumerico.toFixed(2).replace('.', ',');
        if (DEBUG) console.log('💰 Usando valor pré-extraído (API não retornou valor):', result.valor);
      }
      
      // Processamento adicional para garantir a validade da data
      if (result.dataEmissao) {
        try {
          // Normalizar formato da data
          let dataProcessada = result.dataEmissao.trim();
          
          // Verificar formato e converter para DD/MM/YYYY se necessário
          if (/^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(dataProcessada)) {
            // Formato YYYY-MM-DD ou YYYY/MM/DD
            const separador = dataProcessada.includes('-') ? '-' : '/';
            const [ano, mes, dia] = dataProcessada.split(separador);
            dataProcessada = `${dia}/${mes}/${ano}`;
          } else if (/^\d{2}[-\.]\d{2}[-\.]\d{4}$/.test(dataProcessada)) {
            // Formato DD-MM-YYYY ou DD.MM.YYYY
            const partes = dataProcessada.split(/[-\.]/);
            dataProcessada = `${partes[0]}/${partes[1]}/${partes[2]}`;
          }
          // Manter formato DD/MM/YYYY como está
          
          result.dataEmissao = dataProcessada;
          if (DEBUG) console.log('📅 Data processada com sucesso:', result.dataEmissao);
        } catch (e) {
          if (DEBUG) console.error('❌ Erro ao processar data:', e);
          
          // Tentar usar data pré-extraída em caso de erro
          if (preData) {
            result.dataEmissao = preData;
            if (DEBUG) console.log('📅 Usando data pré-extraída após erro:', result.dataEmissao);
          } else {
            // Usar data atual como fallback somente se necessário
            const hoje = new Date();
            const dia = String(hoje.getDate()).padStart(2, '0');
            const mes = String(hoje.getMonth() + 1).padStart(2, '0');
            const ano = hoje.getFullYear();
            result.dataEmissao = `${dia}/${mes}/${ano}`;
            if (DEBUG) console.log('📅 Usando data atual como fallback:', result.dataEmissao);
          }
        }
      } else if (preData) {
        // Se a API não retornou data mas temos uma data pré-extraída, usar ela
        result.dataEmissao = preData;
        if (DEBUG) console.log('📅 Usando data pré-extraída (API não retornou data):', result.dataEmissao);
      } else {
        // Se não tem nenhuma data, usar a data atual
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
        result.dataEmissao = `${dia}/${mes}/${ano}`;
        if (DEBUG) console.log('📅 Usando data atual (não há dados de data):', result.dataEmissao);
      }

      // VERIFICAÇÃO FINAL DE SEGURANÇA
      // Garantir que o número do documento continua sendo o link completo
      if (result.numeroDocumento !== linkCompleto) {
        if (DEBUG) console.warn('⚠️ CORREÇÃO: Número do documento foi modificado, restaurando...');
        result.numeroDocumento = linkCompleto;
      }

      if (DEBUG) console.log('✅ [FIM EXTRACAO] Dados finais retornados pelo serviço:', result);
      return result;
    } catch (error) {
      // Limpar timeout em caso de erro
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        if (DEBUG) console.error('⏱️ TIMEOUT: A requisição para a API excedeu o tempo limite.');
        return {
          error: 'A requisição para a API excedeu o tempo limite.',
          numeroDocumento: linkCompleto // CRUCIAL: Garantir que pelo menos o número do documento (link) seja retornado
        };
      }
      
      if (DEBUG) console.error('❌ Erro durante a extração de dados:', error);
      return {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        numeroDocumento: linkCompleto // CRUCIAL: Garantir que pelo menos o número do documento (link) seja retornado
      };
    }
  } catch (generalError) {
    if (DEBUG) console.error('❌ Erro geral na extração:', generalError);
    return {
      error: generalError instanceof Error ? generalError.message : 'Erro desconhecido na extração',
      numeroDocumento: qrCodeLink // CRUCIAL: Garantir que pelo menos o número do documento (link) seja retornado
    };
  }
} 