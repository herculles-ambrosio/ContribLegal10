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

    // Método específico para SEFAZ MG - sabemos que os números são normalmente 9 dígitos
    // Procurar por número do documento na seção principal (prioritário)
    $('*').each((i, el) => {
      if (numeroDocumento) return false;
      
      const text = $(el).text().trim();
      // Procurar termos específicos relacionados a número do documento
      if (text.includes('Número') || text.includes('Nº') || text.includes('Documento') || 
          text.includes('Cupom') || text.includes('SAT')) {
        
        // Verificar no próprio texto
        const match = text.match(/[\d]{6,9}/);
        if (match) {
          numeroDocumento = match[0];
          console.log(`API - Número do documento encontrado no texto: ${numeroDocumento}`);
          return false;
        }
        
        // Verificar no elemento pai
        const parent = $(el).parent();
        const parentText = parent.text();
        const parentMatch = parentText.match(/[\d]{6,9}/);
        if (parentMatch && parentMatch[0] !== text) {
          numeroDocumento = parentMatch[0];
          console.log(`API - Número do documento encontrado no elemento pai: ${numeroDocumento}`);
          return false;
        }
        
        // Verificar em elementos irmãos
        const siblings = parent.children();
        siblings.each((i, sib) => {
          if (numeroDocumento) return false;
          
          const sibText = $(sib).text().trim();
          const match = sibText.match(/[\d]{6,9}/);
          if (match && sibText !== text) {
            numeroDocumento = match[0];
            console.log(`API - Número do documento encontrado no elemento irmão: ${numeroDocumento}`);
            return false;
          }
        });
        
        // Verificar nos elementos próximos
        const next = $(el).next();
        const nextText = next.text().trim();
        const nextMatch = nextText.match(/[\d]{6,9}/);
        if (nextMatch) {
          numeroDocumento = nextMatch[0];
          console.log(`API - Número do documento encontrado no próximo elemento: ${numeroDocumento}`);
          return false;
        }
      }
    });
    
    // Se ainda não encontrou, verificar números grandes isolados
    if (!numeroDocumento) {
      // Procurar números isolados no HTML que tenham entre 6 e 10 dígitos
      $('*').each((i, el) => {
        if (numeroDocumento) return false;
        
        const text = $(el).text().trim();
        // Números isolados
        if (/^[\d]{6,10}$/.test(text)) {
          numeroDocumento = text;
          console.log(`API - Número do documento encontrado como texto isolado: ${numeroDocumento}`);
          return false;
        }
      });
    }
    
    // Se ainda não encontrou, recorrer a padrões regex no HTML completo
    if (!numeroDocumento) {
      const padroes = [
        // Padrões específicos da SEFAZ MG
        /COO:\s*([0-9]{6,})/i,
        /Extrato nº\s*([0-9]{6,})/i,
        /Número do CF-e-SAT:\s*([0-9]{6,})/i,
        /Número do Documento:\s*([0-9]{6,})/i,
        /Número\s*(?:do|da)?\s*(?:Cupom|Nota)?\s*:?\s*([0-9]{6,})/i,
        /SAT\s*(?:Nº|número|num)?\s*:?\s*([0-9]{6,})/i,
        /NF(?:e|ce)?\s*(?:Nº|número|num)?\s*:?\s*([0-9]{6,})/i,
        /Número\s*:?\s*([0-9]{6,})/i,
        /Nº\s*:?\s*([0-9]{6,})/i,
        // Atributos comuns em HTML que podem ter o número do documento
        /documentNumber["':=]\s*["']?([0-9]{6,})/i,
        /nNF["':=]\s*["']?([0-9]{6,})/i,
        /cNF["':=]\s*["']?([0-9]{6,})/i,
        /numeroCupom["':=]\s*["']?([0-9]{6,})/i,
        /numeroCF["':=]\s*["']?([0-9]{6,})/i,
        // Último recurso - procurar números grandes no texto
        /(\d{6,10})/
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

function extrairValor(html: string): string | undefined {
  try {
    // Carregar o HTML com Cheerio
    const $ = cheerio.load(html);
    
    // Variável para armazenar o valor encontrado
    let valorEncontrado: string | undefined;
    
    // Método 1: Procurar por elementos específicos que geralmente contêm o valor
    // Procurar em divs/spans/tags que tenham classes ou IDs específicos
    $('*[id*="valor"], *[id*="total"], *[id*="preco"], *[class*="valor"], *[class*="total"], *[class*="preco"]').each((i, el) => {
      if (valorEncontrado) return false;
      
      const text = $(el).text().trim();
      // Regex para extrair valores monetários (R$ X,XX ou apenas X,XX)
      const match = text.match(/R\$\s*([0-9.,]+)|([0-9]+[,.][0-9]{2})/);
      if (match) {
        const valor = (match[1] || match[2]).replace(/\./g, '').replace(',', '.');
        if (!isNaN(parseFloat(valor))) {
          valorEncontrado = valor;
          console.log(`API - Valor encontrado em elemento específico: ${valorEncontrado}`);
          return false;
        }
      }
    });
    
    // Método 2: Procurar por labels/texto específicos
    if (!valorEncontrado) {
      const labelsValor = [
        'VALOR PAGO',
        'VALOR TOTAL',
        'Valor pago',
        'Valor Total',
        'Valor do Documento',
        'Valor da Nota',
        'Total do documento',
        'TOTAL',
        'Total',
        'Valor final',
        'Valor'
      ];
      
      for (const label of labelsValor) {
        if (valorEncontrado) break;
        
        // Procurar elementos que contenham o label
        $('*').each((i, el) => {
          if (valorEncontrado) return false;
          
          const text = $(el).text().trim();
          if (text.includes(label)) {
            // Verificar no próprio texto
            const match = text.match(/R\$\s*([0-9.,]+)|([0-9]+[,.][0-9]{2})/);
            if (match) {
              const valor = (match[1] || match[2]).replace(/\./g, '').replace(',', '.');
              if (!isNaN(parseFloat(valor))) {
                valorEncontrado = valor;
                console.log(`API - Valor encontrado junto ao label: ${valorEncontrado}`);
                return false;
              }
            }
            
            // Verificar no elemento pai
            const parent = $(el).parent();
            const parentText = parent.text().trim();
            const parentMatch = parentText.match(/R\$\s*([0-9.,]+)|([0-9]+[,.][0-9]{2})/);
            if (parentMatch && !parentText.includes(text)) {
              const valor = (parentMatch[1] || parentMatch[2]).replace(/\./g, '').replace(',', '.');
              if (!isNaN(parseFloat(valor))) {
                valorEncontrado = valor;
                console.log(`API - Valor encontrado no elemento pai: ${valorEncontrado}`);
                return false;
              }
            }
            
            // Verificar em irmãos
            const siblings = parent.children();
            siblings.each((i, sib) => {
              if (valorEncontrado) return false;
              
              const sibText = $(sib).text().trim();
              if (sibText !== text) {
                const match = sibText.match(/R\$\s*([0-9.,]+)|([0-9]+[,.][0-9]{2})/);
                if (match) {
                  const valor = (match[1] || match[2]).replace(/\./g, '').replace(',', '.');
                  if (!isNaN(parseFloat(valor))) {
                    valorEncontrado = valor;
                    console.log(`API - Valor encontrado em elemento irmão: ${valorEncontrado}`);
                    return false;
                  }
                }
              }
            });
            
            // Verificar nos elementos próximos
            const next = $(el).next();
            const nextText = next.text().trim();
            const nextMatch = nextText.match(/R\$\s*([0-9.,]+)|([0-9]+[,.][0-9]{2})/);
            if (nextMatch) {
              const valor = (nextMatch[1] || nextMatch[2]).replace(/\./g, '').replace(',', '.');
              if (!isNaN(parseFloat(valor))) {
                valorEncontrado = valor;
                console.log(`API - Valor encontrado no próximo elemento: ${valorEncontrado}`);
                return false;
              }
            }
          }
        });
      }
    }
    
    // Método 3: Procurar valores monetários isolados (último recurso)
    if (!valorEncontrado) {
      // Procurar valores com formato monetário brasileiro
      const padroes = [
        // Prioridade para valores monetários precisos
        /valor\s*(?:pago|total)?.*?R\$\s*([0-9.,]+)/i,
        /total.*?R\$\s*([0-9.,]+)/i,
        /R\$\s*([0-9]+[,.][0-9]{2})/,   // R$ seguido de X,XX ou X.XX
        /([0-9]+[,.][0-9]{2})\s*R\$/,   // X,XX ou X.XX seguido de R$
        /TOTAL:?\s*R?\$?\s*([0-9.,]+)/i,
        // Atributos em HTML/JSON
        /"valor(?:Total|Pago)?"\s*:\s*"?([0-9.,]+)"?/i,
        /'valor(?:Total|Pago)?'\s*:\s*'?([0-9.,]+)'?/i,
        /valorNF(?:e|ce)?["':=]\s*["']?([0-9.,]+)/i,
        // Último recurso - valores monetários genéricos
        /R\$\s*([0-9.,]+)/,
        /([0-9]+[,.][0-9]{2})/          // Qualquer número com 2 casas decimais
      ];
      
      for (const padrao of padroes) {
        const match = html.match(padrao);
        if (match && match[1]) {
          // Normalizar formato (remover pontos de milhar e usar ponto para decimal)
          let valor = match[1].trim().replace(/\s/g, '');
          
          // Verificar se o valor tem formato brasileiro (vírgula para decimais)
          if (valor.includes(',')) {
            valor = valor.replace(/\./g, '').replace(',', '.');
          }
          
          // Validar como número
          if (!isNaN(parseFloat(valor))) {
            valorEncontrado = valor;
            console.log(`API - Valor extraído por regex (padrão ${padrao}): ${valorEncontrado}`);
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
    
    // Método 1: Procurar labels específicos com Cheerio
    const labelsData = [
      'Data de Emissão',
      'Data Emissão',
      'Emissão',
      'Data',
      'Dt. Emissão',
      'DT. EMISSÃO',
      'DATA EMISSÃO',
      'DATA DE EMISSÃO',
      'DATA'
    ];
    
    for (const label of labelsData) {
      if (dataEncontrada) break;
      
      // Procurar elementos que contenham o label
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
          
          // Verificar no elemento pai
          const parent = $(el).parent();
          const parentText = parent.text().trim();
          const parentMatch = parentText.match(/(\d{2}\/\d{2}\/\d{4})|(\d{2}\.\d{2}\.\d{4})|(\d{4}-\d{2}-\d{2})/);
          if (parentMatch && !text.includes(parentMatch[0])) {
            dataEncontrada = normalizarData(parentMatch[0]);
            console.log(`API - Data encontrada no elemento pai: ${dataEncontrada}`);
            return false;
          }
          
          // Verificar em irmãos
          const siblings = parent.children();
          siblings.each((i, sib) => {
            if (dataEncontrada) return false;
            
            const sibText = $(sib).text().trim();
            if (sibText !== text) {
              const match = sibText.match(/(\d{2}\/\d{2}\/\d{4})|(\d{2}\.\d{2}\.\d{4})|(\d{4}-\d{2}-\d{2})/);
              if (match) {
                dataEncontrada = normalizarData(match[0]);
                console.log(`API - Data encontrada em elemento irmão: ${dataEncontrada}`);
                return false;
              }
            }
          });
          
          // Verificar nos elementos próximos
          const next = $(el).next();
          const nextText = next.text().trim();
          const nextMatch = nextText.match(/(\d{2}\/\d{2}\/\d{4})|(\d{2}\.\d{2}\.\d{4})|(\d{4}-\d{2}-\d{2})/);
          if (nextMatch) {
            dataEncontrada = normalizarData(nextMatch[0]);
            console.log(`API - Data encontrada no próximo elemento: ${dataEncontrada}`);
            return false;
          }
        }
      });
    }
    
    // Método 2: Procurar por datas completas no documento
    if (!dataEncontrada) {
      // Procurar datas formatadas em qualquer lugar do HTML
      const padroes = [
        // Padrões para data brasileira (DD/MM/AAAA)
        /Data\s*(?:de)?\s*Emissão\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
        /Emissão\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
        /Dt\.\s*Emissão\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
        /Data\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
        // Padrões para data ISO (AAAA-MM-DD)
        /data(?:Emissao)?["':=]\s*["']?(\d{4}-\d{2}-\d{2})/i,
        /dhEmi["':=]\s*["']?(\d{4}-\d{2}-\d{2})/i,
        // Último recurso - procurar qualquer data formatada no texto
        /(\d{2}\/\d{2}\/\d{4})/,
        /(\d{4}-\d{2}-\d{2})/
      ];
      
      for (const padrao of padroes) {
        const match = html.match(padrao);
        if (match && match[1]) {
          dataEncontrada = normalizarData(match[1]);
          console.log(`API - Data extraída por regex (padrão ${padrao}): ${dataEncontrada}`);
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