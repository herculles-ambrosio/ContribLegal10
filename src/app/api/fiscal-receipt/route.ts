import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic'; // Sem cache para esta rota

// Lista de origens permitidas para CORS
const allowedOrigins = ['*']; // Permitir qualquer origem - remover em produção

// Headers para CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Permitir qualquer origem
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Lidar com requisição OPTIONS (preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

interface FiscalReceiptData {
  numeroDocumento?: string;
  valor?: string;
  dataEmissao?: string;
  error?: string;
}

// Tipagem para os dados da requisição
interface FiscalReceiptRequest {
  qrCodeLink: string;
  preExtractedValor?: string;
  preExtractedData?: string;
  originalLinkPreserve?: string; // Campo para garantir a preservação do link original
}

export async function POST(request: NextRequest) {
  try {
    // Configuração de CORS para a resposta
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json',
    };
    
    // Obter dados da requisição
    const data: FiscalReceiptRequest = await request.json();
    const qrCodeUrl = data.qrCodeLink;
    const preExtractedValor = data.preExtractedValor; // Valor pré-extraído
    const preExtractedData = data.preExtractedData; // Data pré-extraída
    const originalLink = data.originalLinkPreserve; // Link original preservado
    
    console.log('API - Link recebido para extração:', qrCodeUrl);
    console.log('API - Link original preservado:', originalLink);
    
    if (!qrCodeUrl) {
      return NextResponse.json(
        { message: 'URL não fornecida' },
        { status: 400, headers: responseHeaders }
      );
    }
    
    // Inicializar variáveis para os dados a serem extraídos
    // IMPORTANTE: Usar o link original como número do documento se disponível
    let numeroDocumento: string | undefined = originalLink || qrCodeUrl;
    let valor: string | undefined = preExtractedValor; // Usar valor pré-extraído se existir
    let dataEmissao: string | undefined = preExtractedData; // Usar data pré-extraída se existir
    
    console.log('API - Valores pré-extraídos:', { preExtractedValor, preExtractedData });

    // Normalizar URL - remover espaços e caracteres estranhos
    const normalizedLink = qrCodeUrl.trim();
    console.log('API-DEBUG > Link normalizado recebido:', normalizedLink);
    
    // IMPORTANTE: Inicialmente, o numeroDocumento DEVE ser o próprio link original
    // Isso garante que, mesmo se as extrações avançadas não funcionarem,
    // o link completo será retornado como numeroDocumento
    if (originalLink) {
      numeroDocumento = originalLink;
      console.log('API-DEBUG > Usando link original preservado como número do documento:', numeroDocumento);
    } else {
      numeroDocumento = normalizedLink;
      console.log('API-DEBUG > Usando link normalizado como número do documento:', numeroDocumento);
    }
    
    // Se não for uma URL completa, tentar adicionar o protocolo
    let urlProcessada = normalizedLink;
    if (!urlProcessada.startsWith('http://') && !urlProcessada.startsWith('https://')) {
      urlProcessada = `https://${urlProcessada}`;
      console.log('API-DEBUG > URL modificada com protocolo https:', urlProcessada);
    }
    
    // Tentar extrair valor do link com padrões mais robustos
    if (!valor) {
      // Padrões de valor comum em URLs de QR codes fiscais
      valor = extrairValorDoLink(urlProcessada);
      if (valor) {
        console.log('API-DEBUG > Valor extraído diretamente do link:', valor);
      }
    }
    
    // Tentar extrair data do link com padrões mais robustos
    if (!dataEmissao) {
      dataEmissao = extrairDataDoLink(urlProcessada);
      if (dataEmissao) {
        console.log('API-DEBUG > Data extraída diretamente do link:', dataEmissao);
      }
    }
    
    // Se já temos todos os dados necessários, podemos retornar imediatamente
    if (valor && dataEmissao) {
      console.log('API-DEBUG > Dados completos extraídos sem precisar acessar a página');
      return NextResponse.json(
        { 
          numeroDocumento,
          valor,
          dataEmissao
        },
        { headers: responseHeaders }
      );
    }
    
    // Se ainda não temos todos os dados, tentar acessar a página para extrair
    try {
      console.log('API-DEBUG > Tentando acessar a página para extrair dados:', urlProcessada);
      
      // Configurar um timeout para a requisição
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 5000);
      
      // Fazer a requisição com headers de um navegador comum
      const response = await fetch(urlProcessada, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: abortController.signal,
        cache: 'no-store',
        next: { revalidate: 0 }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const html = await response.text();
        
        // Tentar extrair valor do HTML se ainda não temos
        if (!valor) {
          valor = extrairValorDoHtml(html);
          if (valor) {
            console.log('API-DEBUG > Valor extraído do HTML:', valor);
          }
        }
        
        // Tentar extrair data do HTML se ainda não temos
        if (!dataEmissao) {
          dataEmissao = extrairDataDoHtml(html);
          if (dataEmissao) {
            console.log('API-DEBUG > Data extraída do HTML:', dataEmissao);
          }
        }
      } else {
        console.log('API-DEBUG > Não foi possível acessar a página, status:', response.status);
      }
    } catch (error) {
      console.error('API-DEBUG > Erro ao acessar a página:', error);
      // Continuar com os dados que já temos
    }
    
    // Formatar valores antes de retornar, para garantir consistência
    if (valor) {
      valor = formatarValor(valor);
    }
    
    if (dataEmissao) {
      dataEmissao = formatarData(dataEmissao);
    }
    
    console.log('API-DEBUG > Dados finais extraídos:', { numeroDocumento, valor, dataEmissao });
    
    // Retornar os dados extraídos
    return NextResponse.json(
      { 
        numeroDocumento,
        valor,
        dataEmissao
      },
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error('API-ERROR > Erro ao processar requisição:', error);
    
    return NextResponse.json(
      { error: 'Erro ao processar a requisição' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Função para extrair valor do link usando regex
function extrairValorDoLink(url: string): string | undefined {
  try {
    // Diversos padrões para encontrar valores monetários em URLs
    const valorPatterns = [
      /[&?]vNF=(\d+[.,]\d+)/i,
      /[&?]vPag=(\d+[.,]\d+)/i,
      /[&?]valor=(\d+[.,]\d+)/i,
      /[&?]total=(\d+[.,]\d+)/i,
      /[&?]valorTotal=(\d+[.,]\d+)/i,
      /[&?]tNF=(\d+[.,]\d+)/i,
      /[&?]valorNF=(\d+[.,]\d+)/i,
      /[&?]vlrNF=(\d+[.,]\d+)/i,
      /[&?]price=(\d+[.,]\d+)/i,
      /[&?]amount=(\d+[.,]\d+)/i,
      /valor:?\s*r?\$?\s*(\d+[.,]\d+)/i,
      /total:?\s*r?\$?\s*(\d+[.,]\d+)/i
    ];

    for (const pattern of valorPatterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Tentar extrair da URL decodificada
    try {
      const decodedUrl = decodeURIComponent(url);
      if (decodedUrl !== url) {
        for (const pattern of valorPatterns) {
          const match = decodedUrl.match(pattern);
          if (match && match[1]) {
            return match[1];
          }
        }
      }
    } catch (e) {
      console.error('Erro ao decodificar URL:', e);
    }
    
    return undefined;
  } catch (e) {
    console.error("Erro ao extrair valor do link:", e);
    return undefined;
  }
}

// Função para extrair data do link usando regex
function extrairDataDoLink(url: string): string | undefined {
  try {
    // Diversos padrões para encontrar datas em URLs
    const dataPatterns = [
      /[&?]dhEmi=(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
      /[&?]dhEmi=(\d{4}[\/\.-]\d{2}[\/\.-]\d{2})/i,
      /[&?]data=(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
      /[&?]data=(\d{4}[\/\.-]\d{2}[\/\.-]\d{2})/i,
      /[&?]dataEmissao=(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
      /[&?]dataEmissao=(\d{4}[\/\.-]\d{2}[\/\.-]\d{2})/i,
      /[&?]dtEmis=(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
      /[&?]dtEmis=(\d{4}[\/\.-]\d{2}[\/\.-]\d{2})/i,
      /[&?]dt=(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
      /[&?]dt=(\d{4}[\/\.-]\d{2}[\/\.-]\d{2})/i,
      /[&?]date=(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
      /[&?]date=(\d{4}[\/\.-]\d{2}[\/\.-]\d{2})/i,
      // Formato timestamp (14 digitos)
      /[&?]dhEmi=(\d{14})/i,
      /[&?]data=(\d{14})/i,
      /[&?]dt=(\d{14})/i
    ];

    for (const pattern of dataPatterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        let dataExtraida = match[1];
        
        // Se for formato timestamp (14 dígitos), converter para data
        if (dataExtraida.length === 14 && /^\d+$/.test(dataExtraida)) {
          // Formato: AAAAMMDDHHMMSS
          const ano = dataExtraida.substring(0, 4);
          const mes = dataExtraida.substring(4, 6);
          const dia = dataExtraida.substring(6, 8);
          dataExtraida = `${dia}/${mes}/${ano}`;
        }
        // Se for formato AAAA-MM-DD ou AAAA/MM/DD, converter para DD/MM/AAAA
        else if (/^([0-9]{4})[-\/]([0-9]{2})[-\/]([0-9]{2})$/.test(dataExtraida)) {
          const matches = dataExtraida.match(/^([0-9]{4})[-\/]([0-9]{2})[-\/]([0-9]{2})$/);
          if (matches) {
            dataExtraida = `${matches[3]}/${matches[2]}/${matches[1]}`;
          }
        }
        
        return dataExtraida.replace(/-/g, '/');
      }
    }
    
    // Tentar extrair da URL decodificada
    try {
      const decodedUrl = decodeURIComponent(url);
      if (decodedUrl !== url) {
        for (const pattern of dataPatterns) {
          const match = decodedUrl.match(pattern);
          if (match && match[1]) {
            let dataExtraida = match[1];
            
            // Aplicar as mesmas conversões de formato
            if (dataExtraida.length === 14 && /^\d+$/.test(dataExtraida)) {
              const ano = dataExtraida.substring(0, 4);
              const mes = dataExtraida.substring(4, 6);
              const dia = dataExtraida.substring(6, 8);
              dataExtraida = `${dia}/${mes}/${ano}`;
            }
            else if (/^([0-9]{4})[-\/]([0-9]{2})[-\/]([0-9]{2})$/.test(dataExtraida)) {
              const matches = dataExtraida.match(/^([0-9]{4})[-\/]([0-9]{2})[-\/]([0-9]{2})$/);
              if (matches) {
                dataExtraida = `${matches[3]}/${matches[2]}/${matches[1]}`;
              }
            }
            
            return dataExtraida.replace(/-/g, '/');
          }
        }
      }
    } catch (e) {
      console.error('Erro ao decodificar URL:', e);
    }
    
    return undefined;
  } catch (e) {
    console.error("Erro ao extrair data do link:", e);
    return undefined;
  }
}

// Função para extrair valor do HTML
function extrairValorDoHtml(html: string): string | undefined {
  try {
    // Diversos padrões para encontrar valores monetários em HTML
    const valorPatterns = [
      /(?:valor|total)[^\d]*r?\$?\s*(\d+[.,]\d+)/i,
      /(?:value|amount|total)[^\d]*r?\$?\s*(\d+[.,]\d+)/i,
      /r\$\s*(\d+[.,]\d+)/i,
      /total:?\s*r?\$?\s*(\d+[.,]\d+)/i,
      /valor:?\s*r?\$?\s*(\d+[.,]\d+)/i,
      /total do documento:?\s*r?\$?\s*(\d+[.,]\d+)/i,
      /total da compra:?\s*r?\$?\s*(\d+[.,]\d+)/i,
      /vNF:?\s*r?\$?\s*(\d+[.,]\d+)/i,
      /tNF:?\s*r?\$?\s*(\d+[.,]\d+)/i,
      /valor da nota:?\s*r?\$?\s*(\d+[.,]\d+)/i,
      /valor da compra:?\s*r?\$?\s*(\d+[.,]\d+)/i,
      /valorNF:?\s*r?\$?\s*(\d+[.,]\d+)/i,
      // Procurar em conteúdo de elementos
      /<[^>]*class="[^"]*valor[^"]*"[^>]*>([^<]*\d+[.,]\d+[^<]*)</i,
      /<[^>]*class="[^"]*total[^"]*"[^>]*>([^<]*\d+[.,]\d+[^<]*)</i,
      /<[^>]*class="[^"]*price[^"]*"[^>]*>([^<]*\d+[.,]\d+[^<]*)</i,
      /<[^>]*id="[^"]*valor[^"]*"[^>]*>([^<]*\d+[.,]\d+[^<]*)</i,
      /<[^>]*id="[^"]*total[^"]*"[^>]*>([^<]*\d+[.,]\d+[^<]*)</i,
      /<[^>]*id="[^"]*price[^"]*"[^>]*>([^<]*\d+[.,]\d+[^<]*)</i
    ];
    
    for (const pattern of valorPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        // Extrair apenas números e pontuação
        const valorText = match[1].replace(/[^\d,.]/g, '');
        if (valorText && /\d/.test(valorText)) {
          return valorText;
        }
      }
    }
    
    return undefined;
  } catch (e) {
    console.error("Erro ao extrair valor do HTML:", e);
    return undefined;
  }
}

// Função para extrair data do HTML
function extrairDataDoHtml(html: string): string | undefined {
  try {
    // Diversos padrões para encontrar datas em HTML
    const dataPatterns = [
      /(?:data\s*(?:de)?\s*emissão|emitido\s*(?:em)?)[^\d]*(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
      /(?:date|emission\s*date)[^\d]*(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
      /(?:data\s*(?:de)?\s*emissão|emitido\s*(?:em)?)[^\d]*(\d{4}[\/\.-]\d{2}[\/\.-]\d{2})/i,
      /(?:date|emission\s*date)[^\d]*(\d{4}[\/\.-]\d{2}[\/\.-]\d{2})/i,
      /data:?\s*(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
      /data:?\s*(\d{4}[\/\.-]\d{2}[\/\.-]\d{2})/i,
      // Procurar em conteúdo de elementos
      /<[^>]*class="[^"]*data[^"]*"[^>]*>([^<]*\d{2}[\/\.-]\d{2}[\/\.-]\d{4}[^<]*)</i,
      /<[^>]*class="[^"]*data[^"]*"[^>]*>([^<]*\d{4}[\/\.-]\d{2}[\/\.-]\d{2}[^<]*)</i,
      /<[^>]*class="[^"]*date[^"]*"[^>]*>([^<]*\d{2}[\/\.-]\d{2}[\/\.-]\d{4}[^<]*)</i,
      /<[^>]*class="[^"]*date[^"]*"[^>]*>([^<]*\d{4}[\/\.-]\d{2}[\/\.-]\d{2}[^<]*)</i,
      /<[^>]*id="[^"]*data[^"]*"[^>]*>([^<]*\d{2}[\/\.-]\d{2}[\/\.-]\d{4}[^<]*)</i,
      /<[^>]*id="[^"]*data[^"]*"[^>]*>([^<]*\d{4}[\/\.-]\d{2}[\/\.-]\d{2}[^<]*)</i,
      /<[^>]*id="[^"]*date[^"]*"[^>]*>([^<]*\d{2}[\/\.-]\d{2}[\/\.-]\d{4}[^<]*)</i,
      /<[^>]*id="[^"]*date[^"]*"[^>]*>([^<]*\d{4}[\/\.-]\d{2}[\/\.-]\d{2}[^<]*)</i
    ];
    
    for (const pattern of dataPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        // Extrair apenas a data
        const dataText = match[1].replace(/[^\d\/\.-]/g, '');
        if (dataText && /\d/.test(dataText)) {
          return dataText;
        }
      }
    }
    
    return undefined;
  } catch (e) {
    console.error("Erro ao extrair data do HTML:", e);
    return undefined;
  }
}

// Função para formatar valor monetário
function formatarValor(valorStr: string): string {
  try {
    // Limpar string e garantir formato correto
    const valorLimpo = valorStr.replace(/[^\d,.]/g, '').replace(',', '.');
    const valor = parseFloat(valorLimpo);
    
    if (isNaN(valor)) {
      return '0,00';
    }
    
    // Formatar para padrão brasileiro
    return valor.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  } catch (e) {
    console.error("Erro ao formatar valor:", e);
    return '0,00';
  }
}

// Função para formatar data para padrão brasileiro
function formatarData(dataStr: string): string {
  try {
    // Se for timestamp (14 dígitos), converter para data
    if (dataStr.length === 14 && /^\d+$/.test(dataStr)) {
      // Formato: AAAAMMDDHHMMSS
      const ano = dataStr.substring(0, 4);
      const mes = dataStr.substring(4, 6);
      const dia = dataStr.substring(6, 8);
      return `${dia}/${mes}/${ano}`;
    }
    
    // Se for formato AAAA-MM-DD ou AAAA/MM/DD, converter para DD/MM/AAAA
    if (/^([0-9]{4})[-\/]([0-9]{2})[-\/]([0-9]{2})$/.test(dataStr)) {
      const matches = dataStr.match(/^([0-9]{4})[-\/]([0-9]{2})[-\/]([0-9]{2})$/);
      if (matches) {
        return `${matches[3]}/${matches[2]}/${matches[1]}`;
      }
    }
    
    // Se já estiver no formato DD/MM/AAAA
    if (/^([0-9]{2})[-\/]([0-9]{2})[-\/]([0-9]{4})$/.test(dataStr)) {
      return dataStr.replace(/-/g, '/');
    }
    
    // Se não for possível formatar, usar a data atual
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${dia}/${mes}/${ano}`;
  } catch (e) {
    console.error("Erro ao formatar data:", e);
    // Retornar data atual como fallback
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
} 