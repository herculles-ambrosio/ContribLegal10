import * as cheerio from 'cheerio';

interface FiscalReceiptData {
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
    const timeoutId = setTimeout(() => controller.abort(), 30000); // Aumentar para 30 segundos
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrCodeLink: normalizedLink }),
        signal: controller.signal,
      });
      
      // Limpar timeout após resposta
      clearTimeout(timeoutId);

      // Aumentar logs para debugging 
      if (!response.ok) {
        const statusText = response.statusText;
        console.error(`Erro na requisição para API: ${response.status} - ${statusText}`);
        
        try {
          // Tentar obter detalhes do erro
          const errorData = await response.text();
          console.error('Detalhes do erro da API:', errorData);
        } catch (e) {
          console.error('Não foi possível ler detalhes do erro');
        }
        
        return { error: `Erro ao extrair dados do cupom fiscal: ${response.status}` };
      }

      const data = await response.json();
      console.log('Resposta da API de extração:', data);

      return data;
    } catch (fetchError) {
      // Limpar timeout em caso de erro
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('Timeout na requisição para o site da SEFAZ');
        return { error: 'Timeout ao acessar a página do cupom fiscal' };
      }
      
      console.error('Erro durante o fetch:', fetchError);
      return { error: 'Erro de conexão ao processar o QR code' };
    }
  } catch (error) {
    console.error('Erro ao extrair dados do cupom fiscal:', error);
    return { error: 'Erro ao processar a página do cupom fiscal' };
  }
} 