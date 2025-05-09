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

    // Normalizar URL - remover espaços e caracteres estranhos
    const normalizedLink = qrCodeLink.trim();
    console.log('API - Link normalizado recebido:', normalizedLink);
    
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
    
    // Se não parece ser um link fiscal válido, registrar mas continuar mesmo assim
    if (!isValidSefazLink) {
      console.warn('API - Link não reconhecido como padrão de cupom fiscal, mas continuando processamento:', normalizedLink);
    }

    console.log('API - Iniciando extração de dados do cupom fiscal:', normalizedLink);

    // Adicionado timeout maior e retry para links da SEFAZ que podem ser lentos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 segundos de timeout

    try {
      // Fazer requisição para o site da SEFAZ MG com headers otimizados
      const response = await fetch(normalizedLink, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      });

      // Limpar timeout após resposta
      clearTimeout(timeoutId);

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

      // Extração de dados com abordagens múltiplas para maior taxa de sucesso
      const dados = extrairDadosCupomFiscal($, html);

      return NextResponse.json(dados, {
        headers: responseHeaders
      });
    } catch (error) {
      // Limpar timeout em caso de erro
      clearTimeout(timeoutId);

      // Verificar se é um erro de timeout
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('API - Timeout na requisição para o site da SEFAZ');
        return NextResponse.json(
          { error: 'Timeout ao acessar a página do cupom fiscal. O servidor da SEFAZ parece estar lento.' },
          { status: 504, headers: responseHeaders }
        );
      }

      console.error('API - Erro ao acessar cupom fiscal:', error);
      return NextResponse.json(
        { error: 'Erro ao processar a página do cupom fiscal' },
        { status: 500, headers: responseHeaders }
      );
    }
  } catch (error) {
    console.error('API - Erro na rota:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Função auxiliar para extrair dados do cupom fiscal usando múltiplas abordagens
function extrairDadosCupomFiscal($: cheerio.CheerioAPI, html: string) {
  let valor = '';
  let dataEmissao = '';
  
  // Tentativa 1: Buscando por textos específicos que precedem o valor
  $('td, th, div, span, label, p, tr').each((i, el) => {
    const text = $(el).text().trim();
    
    if (text.includes('Valor Total R$') || 
        text.includes('VALOR TOTAL DA NOTA') || 
        text.includes('Valor a Pagar R$') ||
        text.includes('Valor total do documento fiscal') ||
        text.includes('Valor Total da NF-e') ||
        text.includes('Valor total da compra') ||
        text.includes('TOTAL R$') ||
        text.includes('Valor pago') ||
        text.includes('VALOR PAGO') ||
        text.includes('Total pago') ||
        text.includes('TOTAL PAGO') ||
        text.includes('Pagamento') ||
        text.includes('Valor do pagamento') ||
        text.includes('Valor a pagar') ||
        text.includes('TOTAL A PAGAR')) {
      
      // Tentar extrair o valor após o texto
      const valorMatch = text.match(/R\$\s*([\d.,]+)/);
      if (valorMatch && valorMatch[1]) {
        valor = valorMatch[1].trim();
        console.log('API - Valor total encontrado via texto:', valor);
      } else {
        // Tentar extrair de um elemento próximo
        const nextElement = $(el).next();
        if (nextElement.length > 0) {
          const nextText = nextElement.text().trim();
          const nextMatch = nextText.match(/R\$\s*([\d.,]+)/) || nextText.match(/([\d.,]+)/);
          if (nextMatch && nextMatch[1]) {
            valor = nextMatch[1].trim();
            console.log('API - Valor total encontrado via elemento próximo:', valor);
          }
        }
      }
    }
    
    // Buscar data de emissão
    if (text.includes('Data de Emissão') || 
        text.includes('Data Emissão') ||
        text.includes('Emissão') ||
        text.includes('Data da Emissão') ||
        text.includes('DATA EMISSÃO') ||
        text.includes('Data/Hora de Emissão') ||
        text.includes('Data: ')) {
      
      // Tentar extrair a data do formato DD/MM/AAAA
      const dataMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (dataMatch && dataMatch[1]) {
        dataEmissao = dataMatch[1];
        console.log('API - Data de emissão encontrada via texto:', dataEmissao);
      } else {
        // Tentar extrair de um elemento próximo
        const nextElement = $(el).next();
        if (nextElement.length > 0) {
          const nextText = nextElement.text().trim();
          const nextMatch = nextText.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (nextMatch && nextMatch[1]) {
            dataEmissao = nextMatch[1];
            console.log('API - Data de emissão encontrada via elemento próximo:', dataEmissao);
          }
        }
      }
    }
  });
  
  // Tentativa 2: Buscar em formato de tabela estruturada
  if (!valor || !dataEmissao) {
    // Buscar em tabelas
    $('table tr').each((i, row) => {
      const rowText = $(row).text().trim();
      
      // Verificar valor total
      if (rowText.includes('Valor Total') || rowText.includes('Total')) {
        const cells = $(row).find('td');
        cells.each((j, cell) => {
          const cellText = $(cell).text().trim();
          const valorMatch = cellText.match(/R\$\s*([\d.,]+)/) || cellText.match(/([\d.,]+)/);
          if (valorMatch && valorMatch[1] && !valor) {
            valor = valorMatch[1].trim();
            console.log('API - Valor total encontrado via tabela:', valor);
          }
        });
      }
      
      // Verificar data de emissão
      if (rowText.includes('Data') || rowText.includes('Emissão')) {
        const cells = $(row).find('td');
        cells.each((j, cell) => {
          const cellText = $(cell).text().trim();
          const dataMatch = cellText.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (dataMatch && dataMatch[1] && !dataEmissao) {
            dataEmissao = dataMatch[1];
            console.log('API - Data de emissão encontrada via tabela:', dataEmissao);
          }
        });
      }
    });
  }
  
  // Tentativa 3: Expressões regulares no HTML completo
  if (!valor) {
    const valorMatches = html.match(/Valor\s*Total\s*[R$]?\s*([\d.,]+)/i) || 
                         html.match(/Total\s*a\s*Pagar\s*[R$]?\s*([\d.,]+)/i) ||
                         html.match(/[R$]\s*([\d.,]+)/);
    if (valorMatches && valorMatches[1]) {
      valor = valorMatches[1].trim();
      console.log('API - Valor total encontrado via regex no HTML:', valor);
    }
  }
  
  if (!dataEmissao) {
    const dataMatches = html.match(/Data\s*de?\s*Emissão\s*[:]?\s*(\d{2}\/\d{2}\/\d{4})/i) ||
                        html.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dataMatches && dataMatches[1]) {
      dataEmissao = dataMatches[1];
      console.log('API - Data de emissão encontrada via regex no HTML:', dataEmissao);
    }
  }
  
  return {
    valor: valor || undefined,
    dataEmissao: dataEmissao || undefined
  };
} 