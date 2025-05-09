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
    
    // Lista expandida de padrões para validação mais flexível
    const domainPatterns = [
      'fazenda.mg.gov.br', 
      'sefaz.mg.gov.br', 
      'portalsped',
      'nfce',
      'sat.sef',
      'nfe.fazenda',
      'sef.mg',
      'fiscal',
      'sped',
      'nf-e',
      'nf.gov',
      'receita'
    ];
    
    // Verificar se o link parece ser válido - validação mais flexível
    const isValidSefazLink = domainPatterns.some(pattern => 
      normalizedLink.toLowerCase().includes(pattern.toLowerCase())
    ) || normalizedLink.startsWith('http') || normalizedLink.includes('.gov.') || normalizedLink.includes('cupom');
    
    // Aviso caso não pareça ser um link válido, mas continuar mesmo assim
    if (!isValidSefazLink) {
      console.warn('Link não reconhecido como padrão de cupom fiscal:', normalizedLink);
      console.warn('Continuando processamento com validação flexível...');
    }

    // Determinar a URL da API baseado no ambiente
    const apiUrl = apiBaseUrl 
      ? `${apiBaseUrl}/api/fiscal-receipt` 
      : '/api/fiscal-receipt';

    console.log('Enviando requisição para API de extração:', normalizedLink);
    console.log('URL da API utilizada:', apiUrl);

    // Fazer requisição para nossa API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qrCodeLink: normalizedLink }),
    });

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
  } catch (error) {
    console.error('Erro ao extrair dados do cupom fiscal:', error);
    return { error: 'Erro ao processar a página do cupom fiscal' };
  }
} 