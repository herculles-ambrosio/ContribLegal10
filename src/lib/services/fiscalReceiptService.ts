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
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    // Se não for uma URL completa, tentar adicionar o protocolo
    let url = normalizedLink;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
      console.log('URL modificada com protocolo https:', url);
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrCodeLink: url }),
        signal: controller.signal,
      });

      // Limpar timeout
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Erro na API: ${response.status}`);
        return {
          error: `Erro ao acessar a API: ${response.status}`,
        };
      }

      const data = await response.json();
      console.log('Dados extraídos:', data);
      
      // Retornar os dados normalizados
      const result = {
        numeroDocumento: data.numeroDocumento,
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
            console.warn('Valor inválido detectado:', result.valor, '- Tratado como indefinido');
            result.valor = undefined;
          } else {
            // Formatação para padrão brasileiro (com vírgula como separador decimal)
            result.valor = valorNumerico.toFixed(2).replace('.', ',');
            console.log('Valor processado com sucesso:', result.valor);
          }
        } catch (e) {
          console.error('Erro ao processar valor:', e);
          result.valor = undefined;
        }
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
        };
      }
      
      console.error('Erro durante a extração de dados:', error);
      return {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  } catch (generalError) {
    console.error('Erro geral na extração:', generalError);
    return {
      error: generalError instanceof Error ? generalError.message : 'Erro desconhecido na extração',
    };
  }
} 