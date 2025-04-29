import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic'; // Sem cache para esta rota

// Configuração de CORS
const allowedOrigins = ['*']; // Em produção, restrinja para os domínios específicos
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Em produção, use o origin real
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handler para requisições OPTIONS (preflight CORS)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

interface FiscalReceiptData {
  valor?: string;
  dataEmissao?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Aplicar headers CORS
    const origin = request.headers.get('origin') || '';
    const responseHeaders = { ...corsHeaders };
    
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      responseHeaders['Access-Control-Allow-Origin'] = origin;
    }

    const { qrCodeLink } = await request.json();
    
    if (!qrCodeLink) {
      return NextResponse.json(
        { error: 'Link do QR Code não fornecido' },
        { status: 400, headers: responseHeaders }
      );
    }

    // Verificar se o link parece ser válido
    if (!qrCodeLink.includes('fazenda.mg.gov.br') && 
        !qrCodeLink.includes('sefaz.mg.gov.br') && 
        !qrCodeLink.includes('portalsped') && 
        !qrCodeLink.includes('nfce')) {
      return NextResponse.json(
        { error: 'O link não parece ser de um cupom fiscal da SEFAZ MG' },
        { status: 400, headers: responseHeaders }
      );
    }

    console.log('API - Iniciando extração de dados do cupom fiscal:', qrCodeLink);

    // Fazer requisição para o site da SEFAZ MG
    const response = await fetch(qrCodeLink, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });

    if (!response.ok) {
      console.error(`API - Erro na requisição HTTP: ${response.status}`);
      return NextResponse.json(
        { error: `Erro ao acessar a página do cupom fiscal: ${response.status}` },
        { status: 500, headers: responseHeaders }
      );
    }

    const html = await response.text();
    console.log('API - HTML recebido, tamanho:', html.length);
    
    // Se o HTML for muito pequeno, pode indicar um redirecionamento ou uma página de erro
    if (html.length < 1000) {
      console.log('API - HTML parece ser muito pequeno, conteúdo:', html);
    }
    
    const $ = cheerio.load(html);
    
    // Log da estrutura básica da página para debug
    console.log('API - Título da página:', $('title').text());
    console.log('API - Elementos de tabela encontrados:', $('table').length);
    console.log('API - Elementos div encontrados:', $('div').length);

    // Extrair o valor total do cupom fiscal
    let valor = '';
    
    // Tentativa 1: Buscando por textos específicos que precedem o valor
    $('td, th, div, span, label, p, tr').each((i, el) => {
      const text = $(el).text().trim();
      
      if (text.includes('Valor Total R$') || 
          text.includes('VALOR TOTAL DA NOTA') || 
          text.includes('Valor a Pagar R$') ||
          text.includes('Valor total do documento fiscal') ||
          text.includes('Valor Total da NF-e') ||
          text.includes('Valor total da compra') ||
          text.includes('TOTAL R$')) {
        
        console.log('API - Encontrado texto relacionado ao valor:', text);
        
        // O valor geralmente está no próximo elemento ou no mesmo elemento
        const nextElement = $(el).next();
        const valorText = nextElement.length ? nextElement.text().trim() : $(el).text().replace(/.*R\$\s*/, '').trim();
        
        console.log('API - Possível texto de valor:', valorText);
        
        if (valorText && /\d+[.,]\d+/.test(valorText)) {
          valor = valorText.replace(/[^\d,.]/g, '').trim();
          // Converter para o formato brasileiro (caso esteja em outro formato)
          valor = valor.replace('.', ',');
          console.log('API - Valor extraído:', valor);
        }
      }
    });

    // Tentativa 2: Buscar por padrões de formatação de valor monetário
    if (!valor) {
      const regex = /R\$\s*([\d.,]+)/g;
      const matches = [...html.matchAll(regex)];
      if (matches.length > 0) {
        console.log('API - Valores monetários encontrados via regex:', matches.map(m => m[1]));
        // Pegar o último valor encontrado (geralmente é o total)
        const lastMatch = matches[matches.length - 1];
        valor = lastMatch[1].replace('.', ',');
        console.log('API - Valor extraído por regex:', valor);
      }
    }

    // Tentativa 3: Buscar em toda a página por números precedidos por R$
    if (!valor) {
      $('*').each((i, el) => {
        const text = $(el).text().trim();
        if (text.includes('R$')) {
          const match = text.match(/R\$\s*([\d.,]+)/);
          if (match) {
            console.log('API - Possível valor encontrado em:', text);
            // Verificar se é um valor total (geralmente maior que outros valores)
            const possibleValue = match[1].replace('.', ',');
            
            // Se já temos um valor, comparar para encontrar o maior (provavelmente o total)
            if (!valor || parseFloat(possibleValue.replace(',', '.')) > parseFloat(valor.replace(',', '.'))) {
              valor = possibleValue;
              console.log('API - Novo valor total candidato:', valor);
            }
          }
        }
      });
    }

    // Extrair a data de emissão
    let dataEmissao = '';
    
    // Tentativa 1: Buscando por textos específicos que precedem a data
    $('td, th, div, span, label, p, tr').each((i, el) => {
      const text = $(el).text().trim();
      
      if (text.includes('Data de Emissão') || 
          text.includes('DATA DE EMISSÃO') || 
          text.includes('Emissão:') ||
          text.includes('Data da Emissão') ||
          text.includes('Data Emissão') ||
          text.includes('Data NF-e')) {
        
        console.log('API - Encontrado texto relacionado à data:', text);
        
        // A data geralmente está no próximo elemento ou no mesmo elemento
        const nextElement = $(el).next();
        const dataText = nextElement.length ? nextElement.text().trim() : $(el).text().replace(/.*Emissão:?\s*/, '').trim();
        
        console.log('API - Possível texto de data:', dataText);
        
        if (dataText && /\d+\/\d+\/\d+/.test(dataText)) {
          // Extrair a data no formato DD/MM/YYYY
          const dateMatch = dataText.match(/(\d+\/\d+\/\d+)/);
          if (dateMatch) {
            dataEmissao = dateMatch[1];
            console.log('API - Data extraída:', dataEmissao);
          }
        }
      }
    });

    // Tentativa 2: Buscar por padrões de data no formato DD/MM/YYYY
    if (!dataEmissao) {
      const dateRegex = /(\d{2}\/\d{2}\/\d{4})/g;
      const dateMatches = [...html.matchAll(dateRegex)];
      if (dateMatches.length > 0) {
        console.log('API - Datas encontradas via regex:', dateMatches.map(m => m[1]));
        // Pegar a primeira data encontrada
        dataEmissao = dateMatches[0][1];
        console.log('API - Data extraída por regex:', dataEmissao);
      }
    }

    // Converter a data para o formato aceito pelo input (YYYY-MM-DD)
    if (dataEmissao) {
      const parts = dataEmissao.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        if (day && month && year) {
          dataEmissao = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          console.log('API - Data convertida para formato ISO:', dataEmissao);
        }
      }
    }

    const result: FiscalReceiptData = {};
    
    if (valor) {
      result.valor = valor;
    }
    
    if (dataEmissao) {
      result.dataEmissao = dataEmissao;
    }
    
    if (!valor && !dataEmissao) {
      result.error = 'Não foi possível extrair os dados do cupom fiscal';
    }

    console.log('API - Dados extraídos finais:', result);

    return NextResponse.json(result, { headers: responseHeaders });
  } catch (error) {
    console.error('API - Erro ao extrair dados do cupom fiscal:', error);
    return NextResponse.json(
      { error: 'Erro ao processar a página do cupom fiscal' },
      { status: 500, headers: corsHeaders }
    );
  }
} 