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
  numeroDocumento?: string;
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
    
    // Aceitar qualquer input como válido
    console.log('API - Processando QR code (formato flexível):', normalizedLink);

    // Aumentar timeout para URLs lentas
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 segundos
    
    let url = normalizedLink;
    
    // Se não for uma URL completa, tentar adicionar o protocolo
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
      console.log('API - URL modificada com protocolo https:', url);
    }

    console.log('API - Iniciando requisição HTTP para:', url);
    
    try {
      // Tentar acessar a página do cupom fiscal com timeout
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          // Tentar simular um navegador para evitar bloqueios
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      
      // Limpar timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`API - Erro ao acessar página: ${response.status} ${response.statusText}`);
        
        // Ainda assim retornar um objeto para evitar erro, mesmo que sem dados
        return NextResponse.json(
          { message: 'QR Code processado, sem dados extraídos' },
          { status: 200, headers: responseHeaders }
        );
      }
      
      // Obter o conteúdo da página
      const html = await response.text();
      console.log(`API - Página acessada com sucesso (${html.length} bytes)`);
      
      // Tentar extrair os dados da página - início com regex básicos
      const dados = {
        numeroDocumento: extrairNumeroDocumento(html),
        valor: extrairValor(html),
        dataEmissao: extrairDataEmissao(html),
      };
      
      console.log('API - Dados extraídos:', dados);
      
      return NextResponse.json(dados, {
        status: 200,
        headers: responseHeaders,
      });
      
    } catch (error) {
      // Limpar timeout em caso de erro
      clearTimeout(timeoutId);

      // Verificar se é um erro de timeout
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('API - Timeout na requisição para o site da SEFAZ');
        return NextResponse.json(
          { message: 'QR Code processado, sem dados extraídos' },
          { status: 200, headers: responseHeaders }
        );
      }

      console.error('API - Erro ao processar a página do cupom fiscal:', error);
      
      // Retornar um objeto para evitar erro, mesmo que sem dados
      return NextResponse.json(
        { message: 'QR Code processado, sem dados extraídos' },
        { status: 200, headers: responseHeaders }
      );
    }
    
  } catch (error) {
    console.error('API - Erro geral ao processar o cupom fiscal:', error);
    return NextResponse.json(
      { message: 'QR Code processado, sem dados extraídos' },
      { status: 200, headers: {...corsHeaders} }
    );
  }
}

// Função para extrair o número do documento
function extrairNumeroDocumento(html: string): string | undefined {
  try {
    // Carregar o HTML com Cheerio para análise mais precisa
    const $ = cheerio.load(html);
    
    // Tentar encontrar o número do documento com Cheerio
    let numeroDocumento: string | undefined;
    
    // Método 1: Buscar texto com números com 6-9 dígitos relacionados ao documento
    $('*').each((i, el) => {
      if (numeroDocumento) return false;
      
      const text = $(el).text().trim();
      // Procurar termos específicos da SEFAZ MG
      if (text.includes('Número') || text.includes('Nº') || text.includes('Documento') || 
          text.includes('Cupom') || text.includes('SAT') || text.includes('Nota')) {
        
        // Verificar números no próprio texto
        const match = text.match(/(?:\D|^)(\d{6,9})(?:\D|$)/);
        if (match && match[1]) {
          numeroDocumento = match[1];
          console.log(`API - Número do documento encontrado no texto: ${numeroDocumento}`);
          return false;
        }
        
        // Verificar nos elementos irmãos
        const parent = $(el).parent();
        const siblings = parent.children();
        siblings.each((i, sib) => {
          if (numeroDocumento) return false;
          
          const sibText = $(sib).text().trim();
          const match = sibText.match(/(?:\D|^)(\d{6,9})(?:\D|$)/);
          if (match && match[1] && $(sib).is(el) === false) {
            numeroDocumento = match[1];
            console.log(`API - Número do documento encontrado no elemento irmão: ${numeroDocumento}`);
            return false;
          }
        });
        
        // Verificar nos elementos próximos
        const next = $(el).next();
        if (next.length > 0) {
          const nextText = next.text().trim();
          const match = nextText.match(/(?:\D|^)(\d{6,9})(?:\D|$)/);
          if (match && match[1]) {
            numeroDocumento = match[1];
            console.log(`API - Número do documento encontrado no próximo elemento: ${numeroDocumento}`);
            return false;
          }
        }
      }
    });
    
    // Método 2: Procurar elementos HTML que contenham apenas um número com 6-9 dígitos
    if (!numeroDocumento) {
      $('*').each((i, el) => {
        if (numeroDocumento) return false;
        
        const text = $(el).text().trim();
        // Números isolados que parecem ser um identificador
        if (/^\d{6,9}$/.test(text)) {
          numeroDocumento = text;
          console.log(`API - Número do documento encontrado como texto isolado: ${numeroDocumento}`);
          return false;
        }
      });
    }
    
    // Método 3: Usar regex para procurar padrões de número de documento no HTML
    if (!numeroDocumento) {
      const padroes = [
        // Padrões comuns para cupons fiscais e notas
        /COO:\s*(\d{6,9})/i,
        /Extrato n[ºo°]\s*(\d{6,9})/i,
        /N[úu]mero do CF-e-SAT:\s*(\d{6,9})/i,
        /N[úu]mero do Documento:\s*(\d{6,9})/i,
        /N[úu]mero\s*(?:do|da)?\s*(?:Cupom|Nota|SAT)?\s*:?\s*(\d{6,9})/i,
        /SAT\s*(?:Nº|número|num)?\s*:?\s*(\d{6,9})/i,
        /NF(?:e|ce)?\s*(?:Nº|número|num)?\s*:?\s*(\d{6,9})/i,
        /CF(?:e|ce)?\s*(?:Nº|número|num)?\s*:?\s*(\d{6,9})/i,
        /Documento\s*(?:Nº|número|num)?\s*:?\s*(\d{6,9})/i,
        // Último recurso: procurar por números específicos
        /(\d{6,9})/
      ];
      
      for (const padrao of padroes) {
        const match = html.match(padrao);
        if (match && match[1]) {
          numeroDocumento = match[1].trim();
          console.log(`API - Número do documento extraído por regex: ${numeroDocumento}`);
          break;
        }
      }
    }
    
    return numeroDocumento;
  } catch (e) {
    console.error('API - Erro ao extrair número do documento:', e);
    return undefined;
  }
}

function extrairValor(html: string): string | undefined {
  try {
    // Carregar o HTML com Cheerio
    const $ = cheerio.load(html);
    
    // Variável para armazenar o valor encontrado
    let valorEncontrado: string | undefined;
    
    // Método 1: Procurar por elementos que geralmente contêm valores monetários
    $('[id*="valor"], [id*="total"], [id*="preco"], [class*="valor"], [class*="total"], [class*="preco"]').each((i, el) => {
      if (valorEncontrado) return false;
      
      const text = $(el).text().trim();
      // Regex para extrair valores monetários
      const match = text.match(/R\$\s*([0-9.,]+)|([0-9]+[,.][0-9]{2})/);
      if (match) {
        const valorStr = match[1] || match[2];
        const valor = valorStr.replace(/\./g, '').replace(',', '.');
        if (!isNaN(parseFloat(valor))) {
          valorEncontrado = valor;
          console.log(`API - Valor encontrado em elemento específico: ${valorEncontrado}`);
          return false;
        }
      }
    });
    
    // Método 2: Procurar por textos que mencionam valores
    if (!valorEncontrado) {
      const labelsValor = [
        'VALOR PAGO', 'VALOR TOTAL', 'TOTAL R$', 'TOTAL:', 
        'Valor pago', 'Valor Total', 'Valor do Documento', 'Valor da Nota',
        'Total do documento', 'TOTAL', 'Total:', 'Valor:'
      ];
      
      for (const label of labelsValor) {
        if (valorEncontrado) break;
        
        $('*').each((i, el) => {
          if (valorEncontrado) return false;
          
          const text = $(el).text().trim();
          if (text.includes(label)) {
            // Verificar no próprio texto
            const match = text.match(/R\$\s*([0-9.,]+)|([0-9]+[,.][0-9]{2})/);
            if (match) {
              const valorStr = match[1] || match[2];
              const valor = valorStr.replace(/\./g, '').replace(',', '.');
              if (!isNaN(parseFloat(valor))) {
                valorEncontrado = valor;
                console.log(`API - Valor encontrado junto ao label: ${valorEncontrado}`);
                return false;
              }
            }
            
            // Verificar em elementos próximos
            const parent = $(el).parent();
            parent.find('*').each((i, child) => {
              if (valorEncontrado || $(child).is(el)) return;
              
              const childText = $(child).text().trim();
              const match = childText.match(/R\$\s*([0-9.,]+)|([0-9]+[,.][0-9]{2})/);
              if (match) {
                const valorStr = match[1] || match[2];
                const valor = valorStr.replace(/\./g, '').replace(',', '.');
                if (!isNaN(parseFloat(valor))) {
                  valorEncontrado = valor;
                  console.log(`API - Valor encontrado em elemento relacionado: ${valorEncontrado}`);
                  return false;
                }
              }
            });
          }
        });
      }
    }
    
    // Método 3: Procurar por qualquer valor monetário no documento
    if (!valorEncontrado) {
      const htmlText = $.text();
      const padroes = [
        /VALOR\s*PAGO\s*:?\s*R?\$?\s*([0-9.,]+)/i,
        /VALOR\s*TOTAL\s*:?\s*R?\$?\s*([0-9.,]+)/i,
        /TOTAL\s*:?\s*R?\$?\s*([0-9.,]+)/i,
        /R\$\s*([0-9]+[,.][0-9]{2})/,
        /([0-9]+[,.][0-9]{2})/
      ];
      
      for (const padrao of padroes) {
        const match = htmlText.match(padrao);
        if (match && match[1]) {
          const valorStr = match[1].trim();
          const valor = valorStr.replace(/\./g, '').replace(',', '.');
          if (!isNaN(parseFloat(valor))) {
            valorEncontrado = valor;
            console.log(`API - Valor extraído do texto: ${valorEncontrado}`);
            break;
          }
        }
      }
    }
    
    return valorEncontrado;
  } catch (e) {
    console.error('API - Erro ao extrair valor:', e);
    return undefined;
  }
}

function extrairDataEmissao(html: string): string | undefined {
  try {
    // Carregar o HTML com Cheerio
    const $ = cheerio.load(html);
    
    // Variável para armazenar a data encontrada
    let dataEncontrada: string | undefined;
    
    // Método 1: Procurar por elementos que mencionam datas
    const labelsData = [
      'Data de Emissão', 'Data Emissão', 'Emissão', 'Data',
      'DATA DE EMISSÃO', 'DATA EMISSÃO', 'EMISSÃO', 'DATA'
    ];
    
    for (const label of labelsData) {
      if (dataEncontrada) break;
      
      $('*').each((i, el) => {
        if (dataEncontrada) return false;
        
        const text = $(el).text().trim();
        if (text.includes(label)) {
          // Verificar no próprio texto
          const match = text.match(/(\d{2}\/\d{2}\/\d{4})|(\d{2}\.\d{2}\.\d{4})|(\d{4}-\d{2}-\d{2})/);
          if (match) {
            dataEncontrada = normalizarData(match[0]);
            console.log(`API - Data encontrada junto ao label: ${dataEncontrada}`);
            return false;
          }
          
          // Verificar em elementos próximos
          const parent = $(el).parent();
          parent.find('*').each((i, child) => {
            if (dataEncontrada || $(child).is(el)) return;
            
            const childText = $(child).text().trim();
            const match = childText.match(/(\d{2}\/\d{2}\/\d{4})|(\d{2}\.\d{2}\.\d{4})|(\d{4}-\d{2}-\d{2})/);
            if (match) {
              dataEncontrada = normalizarData(match[0]);
              console.log(`API - Data encontrada em elemento relacionado: ${dataEncontrada}`);
              return false;
            }
          });
        }
      });
    }
    
    // Método 2: Procurar qualquer data no documento
    if (!dataEncontrada) {
      const htmlText = $.text();
      const padroes = [
        /Data\s*(?:de)?\s*Emiss[ãa]o\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
        /Emiss[ãa]o\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
        /Data\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
        /dhEmi["':=]\s*["']?(\d{4}-\d{2}-\d{2})/i,
        /(\d{2}\/\d{2}\/\d{4})/,
        /(\d{4}-\d{2}-\d{2})/
      ];
      
      for (const padrao of padroes) {
        const match = htmlText.match(padrao);
        if (match && match[1]) {
          dataEncontrada = normalizarData(match[1]);
          console.log(`API - Data extraída do texto: ${dataEncontrada}`);
          break;
        }
      }
    }
    
    return dataEncontrada;
  } catch (e) {
    console.error('API - Erro ao extrair data:', e);
    return undefined;
  }
}

// Função auxiliar para normalizar datas para formato DD/MM/AAAA
function normalizarData(dataStr: string): string {
  // Verificar se é formato ISO (YYYY-MM-DD)
  if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  
  // Verificar se é formato com pontos (DD.MM.AAAA)
  if (dataStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
    return dataStr.replace(/\./g, '/');
  }
  
  // Se já está no formato DD/MM/AAAA, retornar como está
  return dataStr;
} 