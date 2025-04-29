import * as cheerio from 'cheerio';

interface FiscalReceiptData {
  valor?: string;
  dataEmissao?: string;
  error?: string;
}

/**
 * Serviço para extrair dados de cupom fiscal da SEFAZ MG a partir do link do QR Code
 */
export async function extractDataFromFiscalReceipt(qrCodeLink: string): Promise<FiscalReceiptData> {
  try {
    // Verificar se o link parece ser válido
    if (!qrCodeLink.includes('fazenda.mg.gov.br') && 
        !qrCodeLink.includes('sefaz.mg.gov.br') && 
        !qrCodeLink.includes('portalsped') && 
        !qrCodeLink.includes('nfce')) {
      return { error: 'O link não parece ser de um cupom fiscal da SEFAZ MG' };
    }

    console.log('Iniciando extração de dados do cupom fiscal:', qrCodeLink);

    // Fazer requisição para o site da SEFAZ MG
    const response = await fetch(qrCodeLink, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });

    if (!response.ok) {
      console.error(`Erro na requisição HTTP: ${response.status}`);
      return { error: `Erro ao acessar a página do cupom fiscal: ${response.status}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extrair o valor total do cupom fiscal
    let valor = '';
    // Tentativa 1: Buscando por textos específicos que precedem o valor
    $('td, th, div, span').each((i, el) => {
      const text = $(el).text().trim();
      if (text.includes('Valor Total R$') || 
          text.includes('VALOR TOTAL DA NOTA') || 
          text.includes('Valor a Pagar R$')) {
        // O valor geralmente está no próximo elemento ou no mesmo elemento
        const nextElement = $(el).next();
        const valorText = nextElement.length ? nextElement.text().trim() : $(el).text().replace(/.*R\$\s*/, '').trim();
        
        if (valorText && /\d+[.,]\d+/.test(valorText)) {
          valor = valorText.replace(/[^\d,.]/g, '').trim();
          // Converter para o formato brasileiro (caso esteja em outro formato)
          valor = valor.replace('.', ',');
        }
      }
    });

    // Tentativa 2: Buscar por padrões de formatação de valor monetário
    if (!valor) {
      const regex = /R\$\s*([\d.,]+)/g;
      const matches = [...html.matchAll(regex)];
      if (matches.length > 0) {
        // Pegar o último valor encontrado (geralmente é o total)
        const lastMatch = matches[matches.length - 1];
        valor = lastMatch[1].replace('.', ',');
      }
    }

    // Extrair a data de emissão
    let dataEmissao = '';
    // Tentativa 1: Buscando por textos específicos que precedem a data
    $('td, th, div, span').each((i, el) => {
      const text = $(el).text().trim();
      if (text.includes('Data de Emissão') || 
          text.includes('DATA DE EMISSÃO') || 
          text.includes('Emissão:')) {
        // A data geralmente está no próximo elemento ou no mesmo elemento
        const nextElement = $(el).next();
        const dataText = nextElement.length ? nextElement.text().trim() : $(el).text().replace(/.*Emissão:?\s*/, '').trim();
        
        if (dataText && /\d+\/\d+\/\d+/.test(dataText)) {
          // Extrair a data no formato DD/MM/YYYY
          const dateMatch = dataText.match(/(\d+\/\d+\/\d+)/);
          if (dateMatch) {
            dataEmissao = dateMatch[1];
          }
        }
      }
    });

    // Tentativa 2: Buscar por padrões de data no formato DD/MM/YYYY
    if (!dataEmissao) {
      const dateRegex = /(\d{2}\/\d{2}\/\d{4})/g;
      const dateMatches = [...html.matchAll(dateRegex)];
      if (dateMatches.length > 0) {
        // Pegar a primeira data encontrada
        dataEmissao = dateMatches[0][1];
      }
    }

    // Converter a data para o formato aceito pelo input (YYYY-MM-DD)
    if (dataEmissao) {
      const [day, month, year] = dataEmissao.split('/');
      if (day && month && year) {
        dataEmissao = `${year}-${month}-${day}`;
      }
    }

    console.log('Dados extraídos:', { valor, dataEmissao });

    return {
      valor,
      dataEmissao,
    };
  } catch (error) {
    console.error('Erro ao extrair dados do cupom fiscal:', error);
    return { error: 'Erro ao processar a página do cupom fiscal' };
  }
} 