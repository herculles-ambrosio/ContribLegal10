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
    // Método 1: Procurar por labels específicos
    let numeroDocumento: string | undefined;
    
    // Procurar em labels comuns usado pela SEFAZ
    const labelsNumeroDocumento = [
      'Número da Nota',
      'Número do Documento',
      'Número do Cupom',
      'Número do SAT',
      'Número',
      'Nº SAT',
      'Nº do Documento',
      'Nº',
      'Nota Fiscal',
      'NF nº',
      'CF nº',
      'SAT nº'
    ];
    
    // Iterar pelos possíveis labels
    for (const label of labelsNumeroDocumento) {
      // Procurar texto contendo o label
      $('*').each((i, el) => {
        const text = $(el).text().trim();
        if (text.includes(label)) {
          // Verificar se há algum número próximo
          const parent = $(el).parent();
          const siblings = parent.children();
          siblings.each((i, sib) => {
            const sibText = $(sib).text().trim();
            // Regex para extrair apenas números
            const match = sibText.match(/\d+/);
            if (match) {
              numeroDocumento = match[0];
              console.log(`API - Número do documento encontrado no elemento irmão: ${numeroDocumento}`);
              return false; // Sair do loop
            }
          });
          
          // Se não encontrou nos irmãos, tentar no próximo elemento
          const next = $(el).next();
          const nextText = next.text().trim();
          const match = nextText.match(/\d+/);
          if (match) {
            numeroDocumento = match[0];
            console.log(`API - Número do documento encontrado no próximo elemento: ${numeroDocumento}`);
            return false; // Sair do loop
          }
        }
      });
      
      if (numeroDocumento) break;
    }
    
    // Se ainda não encontrou, tentar regex no HTML
    if (!numeroDocumento) {
      // Tentar diferentes padrões para extrair o número do documento
      const padroes = [
        /Número do Documento:?\s*([0-9]+)/i,
        /Número:?\s*([0-9]+)/i,
        /Nº:?\s*([0-9]+)/i,
        /NF\s*nº:?\s*([0-9]+)/i,
        /Documento:?\s*([0-9]+)/i,
        /Cupom Fiscal:?\s*([0-9]+)/i,
        /Nota Fiscal:?\s*([0-9]+)/i,
        /SAT:?\s*([0-9]+)/i,
        /Nº SAT:?\s*([0-9]+)/i,
        /CF:?\s*([0-9]+)/i,
        /ECF:?\s*([0-9]+)/i,
        /nNF["':=]\s*["']?([0-9]+)/i,
        /cNF["':=]\s*["']?([0-9]+)/i,
        /numeroCupom["':=]\s*["']?([0-9]+)/i,
        /numeroCF["':=]\s*["']?([0-9]+)/i,
        /Nro\.?\s*([0-9]{6,})/i,  // Procura números grandes (6+ dígitos)
        /(\d{9,})/  // Qualquer sequência de 9 ou mais dígitos no HTML
      ];
      
      for (const padrao of padroes) {
        const match = html.match(padrao);
        if (match && match[1]) {
          numeroDocumento = match[1].trim();
          console.log(`API - Número do documento extraído por regex (padrão ${padrao}): ${numeroDocumento}`);
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

// Funções de extração de dados mais robustas

function extrairValor(html: string): string | undefined {
  try {
    // Carregar o HTML com Cheerio
    const $ = cheerio.load(html);
    
    // Procurar primeiro usando Cheerio por labels comuns de valor
    const labelsValor = [
      'Valor pago',
      'Valor Total',
      'Valor do Documento',
      'Valor da Nota',
      'Total',
      'Valor final',
      'Valor'
    ];
    
    // Variável para armazenar o valor encontrado
    let valorEncontrado: string | undefined;
    
    // Iterar pelos possíveis labels
    for (const label of labelsValor) {
      if (valorEncontrado) break;
      
      // Procurar texto contendo o label
      $('*').each((i, el) => {
        if (valorEncontrado) return false; // Encerrar o loop se já encontrou
        
        const text = $(el).text().trim();
        if (text.includes(label)) {
          // Verificar se há algum valor próximo
          const parent = $(el).parent();
          const siblings = parent.children();
          siblings.each((i, sib) => {
            if (valorEncontrado) return false; // Encerrar o loop se já encontrou
            
            const sibText = $(sib).text().trim();
            // Regex para extrair valor no formato R$ X,XX ou apenas X,XX
            const match = sibText.match(/R\$\s*([0-9.,]+)|([0-9,.]+)/);
            if (match) {
              const valorStr = match[1] || match[2];
              const valor = valorStr.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
              if (!isNaN(parseFloat(valor))) {
                console.log(`API - Valor encontrado por Cheerio: ${valor}`);
                valorEncontrado = valor;
                return false; // Encerrar o loop
              }
            }
          });
        }
      });
    }
    
    // Se encontrou valor com Cheerio, retornar
    if (valorEncontrado) {
      return valorEncontrado;
    }
    
    // Tentar diferentes padrões para extrair o valor
    const padroes = [
      /valor pago\s*(?:R\$)?\s*([0-9.,]+)/i,
      /valor total R\$\s*([0-9.,]+)/i,
      /Valor\s*Total\s*(?:do|da|dos|das)?\s*(?:Documento|Cupom|Nota)?\s*:?\s*R\$?\s*([0-9.,]+)/i,
      /Total\s*(?:R\$|\$)?\s*([0-9.,]+)/i,
      /(?:R\$|\$)\s*([0-9.,]+)/i,
      /"valorTotal"\s*:\s*"([^"]+)"/i,
      /valorNF(?:e|ce)?["':=]\s*["']?([0-9.,]+)/i,
    ];
    
    for (const padrao of padroes) {
      const match = html.match(padrao);
      if (match && match[1]) {
        // Normalizar formato do valor (remover espaços e trocar , por .)
        let valor = match[1].trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
        // Remover caracteres não numéricos
        valor = valor.replace(/[^\d.]/g, '');
        
        if (!isNaN(parseFloat(valor))) {
          console.log(`API - Valor extraído (padrão ${padrao}): ${valor}`);
          return valor;
        }
      }
    }
    
    return undefined;
  } catch (e) {
    console.error('API - Erro ao extrair valor:', e);
    return undefined;
  }
}

function extrairDataEmissao(html: string): string | undefined {
  try {
    // Tentar diferentes padrões para extrair a data
    const padroes = [
      /Data\s*(?:de)?\s*Emissão\s*:?\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
      /Emissão\s*:?\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
      /([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
      /data(?:Emissao)?["':=]\s*["']?([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i,
      /dhEmi["':=]\s*["']?([0-9]{4}-[0-9]{2}-[0-9]{2})/i
    ];
    
    for (const padrao of padroes) {
      const match = html.match(padrao);
      if (match && match[1]) {
        const dataStr = match[1].trim();
        
        // Verificar se é formato YYYY-MM-DD e converter para DD/MM/YYYY
        if (dataStr.match(/[0-9]{4}-[0-9]{2}-[0-9]{2}/)) {
          const [ano, mes, dia] = dataStr.split('-');
          console.log(`API - Data extraída (formato ISO): ${dataStr} -> ${dia}/${mes}/${ano}`);
          return `${dia}/${mes}/${ano}`;
        }
        
        console.log(`API - Data extraída (padrão ${padrao}): ${dataStr}`);
        return dataStr;
      }
    }
    
    return undefined;
  } catch (e) {
    console.error('API - Erro ao extrair data:', e);
    return undefined;
  }
} 