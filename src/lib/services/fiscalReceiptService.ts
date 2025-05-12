import * as cheerio from 'cheerio';

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
    // Normalizar URL - remover espaços e caracteres estranhos
    const normalizedLink = qrCodeLink.trim();
    console.log('Link normalizado para extração:', normalizedLink);
    
    // Aceitar qualquer formato de QR code, sem restrições
    console.log('Processando QR code (formato flexível):', normalizedLink);
    
    // Determinar a URL da API baseado no ambiente
    const apiUrl = apiBaseUrl 
      ? `${apiBaseUrl}/api/fiscal-receipt` 
      : '/api/fiscal-receipt';

    console.log('Enviando requisição para API de extração:', normalizedLink);
    console.log('URL da API utilizada:', apiUrl);

    // Fazer requisição para nossa API com timeout aumentado
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // Aumentado para 45s
    
    // Se não for uma URL completa, tentar adicionar o protocolo
    let url = normalizedLink;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
      console.log('URL modificada com protocolo https:', url);
    }

    try {
      // Tentar extrair valores diretamente do link, antes mesmo de fazer a requisição
      // isso oferece uma camada de redundância caso a API falhe
      let preValor: string | undefined = undefined;
      let preData: string | undefined = undefined;
      
      // Muitos QR codes de cupons fiscais têm parâmetros que indicam valores
      try {
        const urlObj = new URL(url);
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
            preValor = val.replace(',', '.');
            console.log('Valor pré-extraído do link:', preValor);
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
            preData = data;
            console.log('Data pré-extraída do link:', preData);
            break;
          }
        }
      } catch (linkError) {
        console.warn('Erro ao tentar extrair dados do link:', linkError);
      }

      // Fazer requisição para a API principal
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          qrCodeLink: url,
          preExtractedValor: preValor,  
          preExtractedData: preData
        }),
        signal: controller.signal,
      });

      // Limpar timeout
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Erro na API: ${response.status}`);
        
        // Se tivemos dados pré-extraídos, retornar esses mesmo com erro na API
        if (preValor || preData) {
          const fallbackResult = {
            numeroDocumento: url, // O link completo é o número do documento
            valor: preValor,
            dataEmissao: preData
          };
          
          console.log('Usando dados pré-extraídos devido a erro na API:', fallbackResult);
          return fallbackResult;
        }
        
        return {
          error: `Erro ao acessar a API: ${response.status}`,
          numeroDocumento: url // Garantir que pelo menos o número do documento (link) seja retornado
        };
      }

      const data = await response.json();
      console.log('Dados extraídos da API:', data);
      
      // Iniciar com o link completo como número do documento
      // independente do que a API retornou
      const result: FiscalReceiptData = {
        numeroDocumento: url,
        valor: data.valor,
        dataEmissao: data.dataEmissao,
      };

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
            console.warn('Valor inválido detectado:', result.valor, '- Verificando valor pré-extraído');
            
            // Se temos um valor pré-extraído do link, usar ele como fallback
            if (preValor && !isNaN(parseFloat(preValor))) {
              const valorPreNumerico = parseFloat(preValor);
              result.valor = valorPreNumerico.toFixed(2).replace('.', ',');
              console.log('Usando valor pré-extraído como fallback:', result.valor);
            } else {
              result.valor = undefined;
            }
          } else {
            // Formatação para padrão brasileiro (com vírgula como separador decimal)
            result.valor = valorNumerico.toFixed(2).replace('.', ',');
            console.log('Valor processado com sucesso:', result.valor);
          }
        } catch (e) {
          console.error('Erro ao processar valor:', e);
          
          // Tentar usar valor pré-extraído em caso de erro
          if (preValor && !isNaN(parseFloat(preValor))) {
            const valorPreNumerico = parseFloat(preValor);
            result.valor = valorPreNumerico.toFixed(2).replace('.', ',');
            console.log('Usando valor pré-extraído após erro:', result.valor);
          } else {
            result.valor = undefined;
          }
        }
      } else if (preValor && !isNaN(parseFloat(preValor))) {
        // Se a API não retornou valor mas temos um valor pré-extraído, usar ele
        const valorPreNumerico = parseFloat(preValor);
        result.valor = valorPreNumerico.toFixed(2).replace('.', ',');
        console.log('Usando valor pré-extraído (API não retornou valor):', result.valor);
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
          console.log('Data processada com sucesso:', result.dataEmissao);
        } catch (e) {
          console.error('Erro ao processar data:', e);
          
          // Tentar usar data pré-extraída em caso de erro
          if (preData) {
            result.dataEmissao = preData;
            console.log('Usando data pré-extraída após erro:', result.dataEmissao);
          } else {
            // Usar data atual como fallback
            const hoje = new Date();
            const dia = String(hoje.getDate()).padStart(2, '0');
            const mes = String(hoje.getMonth() + 1).padStart(2, '0');
            const ano = hoje.getFullYear();
            result.dataEmissao = `${dia}/${mes}/${ano}`;
            console.log('Usando data atual como fallback:', result.dataEmissao);
          }
        }
      } else if (preData) {
        // Se a API não retornou data mas temos uma data pré-extraída, usar ela
        result.dataEmissao = preData;
        console.log('Usando data pré-extraída (API não retornou data):', result.dataEmissao);
      } else {
        // Se não tem nenhuma data, usar a data atual
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
        result.dataEmissao = `${dia}/${mes}/${ano}`;
        console.log('Usando data atual (não há dados de data):', result.dataEmissao);
      }

      console.log('Dados finais retornados pelo serviço:', result);
      return result;
    } catch (error) {
      // Limpar timeout em caso de erro
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Timeout na requisição para a API');
        return {
          error: 'A requisição para a API excedeu o tempo limite.',
          numeroDocumento: url // Garantir que pelo menos o número do documento (link) seja retornado
        };
      }
      
      console.error('Erro durante a extração de dados:', error);
      return {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        numeroDocumento: url // Garantir que pelo menos o número do documento (link) seja retornado
      };
    }
  } catch (generalError) {
    console.error('Erro geral na extração:', generalError);
    return {
      error: generalError instanceof Error ? generalError.message : 'Erro desconhecido na extração',
      numeroDocumento: qrCodeLink // Garantir que pelo menos o número do documento (link) seja retornado
    };
  }
} 