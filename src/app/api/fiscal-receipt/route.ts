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

// Funções de extração de dados mais robustas

function extrairValor(html: string): string | undefined {
  try {
    // Tentar diferentes padrões para extrair o valor
    const padroes = [
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