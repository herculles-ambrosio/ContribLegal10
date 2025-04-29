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
    // Verificar se o link parece ser válido
    if (!qrCodeLink.includes('fazenda.mg.gov.br') && 
        !qrCodeLink.includes('sefaz.mg.gov.br') && 
        !qrCodeLink.includes('portalsped') && 
        !qrCodeLink.includes('nfce')) {
      return { error: 'O link não parece ser de um cupom fiscal da SEFAZ MG' };
    }

    // Determinar a URL da API baseado no ambiente
    const apiUrl = apiBaseUrl 
      ? `${apiBaseUrl}/api/fiscal-receipt` 
      : '/api/fiscal-receipt';

    console.log('Enviando requisição para API de extração:', qrCodeLink);
    console.log('URL da API utilizada:', apiUrl);

    // Fazer requisição para nossa API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qrCodeLink }),
    });

    if (!response.ok) {
      console.error(`Erro na requisição para API: ${response.status}`);
      return { error: `Erro ao extrair dados do cupom fiscal: ${response.status}` };
    }

    const data = await response.json();
    console.log('Resposta da API de extração:', data);

    return data;
  } catch (error) {
    console.error('Erro ao extrair dados do cupom fiscal:', error);
    return { error: 'Erro ao processar a página do cupom fiscal' };
  }
} 