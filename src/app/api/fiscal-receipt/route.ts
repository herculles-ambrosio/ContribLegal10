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
    const preExtractedValor = data.preExtractedValor; // Novo: valor pré-extraído
    const preExtractedData = data.preExtractedData; // Novo: data pré-extraída
    
    console.log('API - Link recebido para extração:', qrCodeUrl);
    
    if (!qrCodeUrl) {
      return NextResponse.json(
        { message: 'URL não fornecida' },
        { status: 400, headers: responseHeaders }
      );
    }
    
    // Inicializar variáveis para os dados a serem extraídos
    let numeroDocumento: string | undefined = undefined;
    let valor: string | undefined = preExtractedValor; // Usar valor pré-extraído se existir
    let dataEmissao: string | undefined = preExtractedData; // Usar data pré-extraída se existir
    
    console.log('API - Valores pré-extraídos:', { preExtractedValor, preExtractedData });

    // Normalizar URL - remover espaços e caracteres estranhos
    const normalizedLink = qrCodeUrl.trim();
    console.log('API-DEBUG > Link normalizado recebido:', normalizedLink);
    
    // IMPORTANTE: Inicialmente, o numeroDocumento DEVE ser o próprio link
    // Isso garante que, mesmo se as extrações avançadas não funcionarem,
    // o link completo será retornado como numeroDocumento
    numeroDocumento = normalizedLink;
    console.log('API-DEBUG > Número do documento inicial (link completo):', numeroDocumento);
    
    // Inicializar o controller para timeout da requisição
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    // Extrair informações do próprio link se possível (comum em QR codes da SEFAZ MG)
    try {
      // Padrões mais robustos para valores em URLs de QR codes fiscais
      // Tentar diversos formatos de acordo com os padrões conhecidos
      const valorPatterns = [
        /(?:vNF=|valorNF=|valor=|total=|vPag=)([0-9,.]+)/i,
        /(?:vNF|valorNF|valor|total|vPag)[=:]([0-9,.]+)/i,
        /(?:R\\$)([0-9,.]+)/i,
        /(?:valor.*?)([0-9]+[,.][0-9]{2})/i,
        /(?:VALOR.*?:?\s*)([0-9]+[,.][0-9]{2})/i,
        /(?:Total.*?:?\s*)([0-9]+[,.][0-9]{2})/i,
        /(?<=total).*?([0-9]+[,.][0-9]{2})/i,
        /(?<=valor).*?([0-9]+[,.][0-9]{2})/i,
        /(?:R\$\s*)([0-9,.]+)/i,  // Com espaços entre R$ e o valor
        /([0-9]+,[0-9]{2})(?=\s*$)/i  // Valor no final da string
      ];
      
      // Testar todos os padrões até encontrar um valor válido
      for (const pattern of valorPatterns) {
        const valorMatch = normalizedLink.match(pattern);
        if (valorMatch && valorMatch[1]) {
          // Normalizar o valor - remover pontos e substituir vírgula por ponto
          let valorExtraido = valorMatch[1].replace(/\./g, '').replace(',', '.');
          
          // Verificar se o valor é válido (deve ser um número)
          if (!isNaN(parseFloat(valorExtraido))) {
            valor = valorExtraido;
            console.log('API-DEBUG > Valor extraído do link:', valor);
            break;
          }
        }
      }
      
      // Tentar extrair data do link com padrões mais robustos
      const dataPatterns = [
        // Padrões de data comuns em URLs de QR codes fiscais
        /(?:dhEmi=|dtEmissao=|data=|dt=)([0-9]{2}[/-][0-9]{2}[/-][0-9]{4})/i,
        /(?:dhEmi=|dtEmissao=|data=|dt=)([0-9]{4}[/-][0-9]{2}[/-][0-9]{2})/i,
        /(?:dhEmi|dtEmissao|data|dt)[=:]([0-9]{2}[/-][0-9]{2}[/-][0-9]{4})/i,
        /(?:dhEmi|dtEmissao|data|dt)[=:]([0-9]{4}[/-][0-9]{2}[/-][0-9]{2})/i,
        /Data:?\s*([0-9]{2}[/-][0-9]{2}[/-][0-9]{4})/i,
        /Data:?\s*([0-9]{4}[/-][0-9]{2}[/-][0-9]{2})/i,
        // Extrair data de formato timestamp
        /(?:dhEmi=|dtEmissao=|data=|dt=)([0-9]{14})/i,
      ];
      
      // Testar todos os padrões
      for (const pattern of dataPatterns) {
        const dataMatch = normalizedLink.match(pattern);
        if (dataMatch && dataMatch[1]) {
          let dataExtraida = dataMatch[1];
          
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
          
          dataEmissao = dataExtraida.replace(/-/g, '/');
          console.log('API-DEBUG > Data extraída do link:', dataEmissao);
          break;
        }
      }
      
      // Extrair valores diretamente do URL usando parâmetros conhecidos
      try {
        // Se o link é uma URL, tentar extrair parâmetros dela
        const url = new URL(normalizedLink);
        
        // Extrair valor de parâmetros explícitos da URL
        const valorParam = url.searchParams.get('vNF') || 
                           url.searchParams.get('valorNF') || 
                           url.searchParams.get('valor') || 
                           url.searchParams.get('total') ||
                           url.searchParams.get('vPag');
                           
        if (valorParam && !isNaN(parseFloat(valorParam.replace(',', '.')))) {
          valor = valorParam.replace(',', '.');
          console.log('API-DEBUG > Valor extraído da URL (parâmetro):', valor);
        }
        
        // Extrair data de parâmetros explícitos da URL
        const dataParam = url.searchParams.get('dhEmi') || 
                          url.searchParams.get('dtEmissao') || 
                          url.searchParams.get('data') || 
                          url.searchParams.get('dt');
                          
        if (dataParam) {
          // Tentar extrair data do parâmetro encontrado
          let dataParamFormatada = dataParam;
          
          // Se for timestamp de 14 dígitos
          if (dataParam.length === 14 && /^\d+$/.test(dataParam)) {
            const ano = dataParam.substring(0, 4);
            const mes = dataParam.substring(4, 6);
            const dia = dataParam.substring(6, 8);
            dataParamFormatada = `${dia}/${mes}/${ano}`;
          } 
          // Se for formato ISO (AAAA-MM-DD)
          else if (/^\d{4}-\d{2}-\d{2}/.test(dataParam)) {
            const [ano, mes, dia] = dataParam.split('-');
            dataParamFormatada = `${dia}/${mes}/${ano}`;
          }
          
          dataEmissao = dataParamFormatada;
          console.log('API-DEBUG > Data extraída da URL (parâmetro):', dataEmissao);
        }
      } catch (urlError) {
        // Ignorar erros ao analisar a URL
        console.log('API-DEBUG > Erro ao analisar URL:', urlError);
      }
    } catch (linkExtractionError) {
      console.error('API-DEBUG > Erro ao extrair dados do link:', linkExtractionError);
    }

    // Preparar a URL para a requisição HTTP
    let requestUrl = normalizedLink;
    
    // Se não for uma URL completa, tentar adicionar o protocolo
    if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) {
      requestUrl = `https://${requestUrl}`;
      console.log('API - URL modificada com protocolo https:', requestUrl);
    }

    console.log('API - Iniciando requisição HTTP para:', requestUrl);
    
    try {
      // Tentar acessar a página do cupom fiscal com timeout
      const response = await fetch(requestUrl, {
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
        
        // Se já tiver extraído algum dado do próprio link, retornar esses dados
        if (numeroDocumento || valor || dataEmissao) {
          console.log('API - Usando dados extraídos do link, pois a página não pôde ser acessada');
          return NextResponse.json({ numeroDocumento, valor, dataEmissao }, {
            status: 200,
            headers: responseHeaders,
          });
        }
        
        // Caso contrário, retornar mensagem sem dados
        return NextResponse.json(
          { message: 'QR Code processado, sem dados extraídos' },
          { status: 200, headers: responseHeaders }
        );
      }
      
      // Obter o conteúdo da página
      const html = await response.text();
      console.log(`API - Página acessada com sucesso (${html.length} bytes)`);
      
      // Carregar o HTML com Cheerio para análise
      const $ = cheerio.load(html);
      
      // EXTRAÇÃO DIRETA ESPECÍFICA PARA SEFAZ MG
      // ========================================
      
      // Tentar extrair "Valor pago R$" especificamente da SEFAZ MG
      if (!valor) {
        try {
          const valorPagoElement = $('strong:contains("Valor pago R$")').nextAll('strong').first();
          if (valorPagoElement.length) {
            const valorText = valorPagoElement.text().trim();
            const match = valorText.match(/^[\d.,]+/); // Pega o valor no início da string
            if (match && match[0]) {
              // Garantir que o valor esteja no formato correto (ponto como separador decimal)
              valor = match[0].replace(/\./g, '').replace(',', '.');
              console.log('API - SEFAZ MG - Valor pago R$ extraído diretamente:', valor);
            }
          }
        } catch (e) {
          console.warn('API - SEFAZ MG - Erro ao tentar extração direta de "Valor pago R$"', e);
        }
      }

      // Tentar extrair "Data Emissão" especificamente da SEFAZ MG da tabela "Informações gerais da Nota"
      if (!dataEmissao) {
        try {
          const infoGeraisTable = $('h5')
            .filter((i, el) => $(el).text().trim() === 'Informações gerais da Nota')
            .first()
            .next('table');

          if (infoGeraisTable.length) {
            // Encontrar a linha que parece conter os dados principais (Modelo, Série, Número, Data Emissão)
            // Essa linha geralmente tem 4 células
            const dataRow = infoGeraisTable.find('tr').filter((i, tr) => $(tr).find('td').length === 4).last();
            if (dataRow.length) {
              const dataCellText = dataRow.find('td').last().text().trim();
              // Espera-se algo como "04/05/2025 15:34:43"
              const match = dataCellText.match(/(\d{2}\/\d{2}\/\d{4})/); // Extrai DD/MM/YYYY
              if (match && match[1]) {
                // Manter no formato DD/MM/YYYY para processamento posterior
                dataEmissao = match[1];
                console.log('API - SEFAZ MG - Data Emissão extraída diretamente da tabela:', dataEmissao);
              }
            }
          }
        } catch (e) {
          console.warn('API - SEFAZ MG - Erro ao tentar extração direta de "Data Emissão"', e);
        }
      }
      
      // 1. Procurar pelo número do documento (se ainda não encontrado no link)
      if (!numeroDocumento) {
        // Extrair número do documento utilizando seletores específicos comuns da SEFAZ MG
        // Seletor específico para NFC-e da SEFAZ MG
        $('.nfce-container .nfce-info, .box-info .numero-nota, .infoDadosNfe .numero, .box-nfce .dado-numero, .info-cupom .coo').each((_, el) => {
          const text = $(el).text().trim();
          const match = text.match(/(?:\d{6,9})|(?:N[Ff][Cc][Ee]?\s*[#:]?\s*(\d+))|(?:[Cc][Oo][Oo]\s*[:]?\s*(\d+))/);
          if (match) {
            numeroDocumento = match[1] || match[2] || match[0];
            console.log('API - Número do documento encontrado em seletor específico:', numeroDocumento);
            return false; // Sair do loop
          }
        });
        
        // Busca geral por elementos que podem conter o número do documento
        if (!numeroDocumento) {
          $('*').each((_, el) => {
            const text = $(el).text().trim();
            
            // Verificar padrões comuns específicos da SEFAZ MG
            if (
              (text.includes('Número') || text.includes('Nota') || text.includes('Cupom') || 
               text.includes('NFC') || text.includes('SAT') || text.includes('ECF') || 
               text.includes('COO') || text.includes('Extrato'))
            ) {
              // Procurar número próximo ao texto identificado
              let numeroMatch = text.match(/(?:N[Ff][Cc][Ee]?\s*[#:]?\s*(\d{6,9}))|(?:Nota\s*[Ff]iscal\s*[#:]?\s*(\d{6,9}))|(?:Cupom\s*[Ff]iscal\s*[#:]?\s*(\d{6,9}))|(?:SAT\s*[#:]?\s*(\d{6,9}))|(?:ECF\s*[#:]?\s*(\d{6,9}))|(?:COO\s*[:]?\s*(\d{6,9}))|(?:Extrato\s*[#:]?\s*(\d{6,9}))|(?:Número\s*[#:]?\s*(\d{6,9}))/i);
              
              if (!numeroMatch) {
                // Tentar um padrão mais simples
                numeroMatch = text.match(/\b(\d{6,9})\b/);
              }
              
              if (numeroMatch) {
                // Pegar o primeiro grupo capturado ou o match completo
                for (let i = 1; i < numeroMatch.length; i++) {
                  if (numeroMatch[i]) {
                    numeroDocumento = numeroMatch[i];
                    console.log('API - Número documento encontrado em texto:', numeroDocumento);
                    return false; // Sair do loop
                  }
                }
                
                if (!numeroDocumento && numeroMatch[0] && /^\d{6,9}$/.test(numeroMatch[0])) {
                  numeroDocumento = numeroMatch[0];
                  console.log('API - Número documento encontrado em texto (match completo):', numeroDocumento);
                  return false;
                }
              }
              
              // Verificar no elemento pai ou próximo
              if (!numeroDocumento) {
                const parent = $(el).parent();
                const parentText = parent.text().trim();
                const parentMatch = parentText.match(/\b(\d{6,9})\b/);
                if (parentMatch && parentMatch[1] && !text.includes(parentMatch[1])) {
                  numeroDocumento = parentMatch[1];
                  console.log('API - Número documento encontrado em elemento pai:', numeroDocumento);
                  return false;
                }
                
                // Verificar próximo elemento
                const next = $(el).next();
                if (next.length) {
                  const nextText = next.text().trim();
                  const nextMatch = nextText.match(/\b(\d{6,9})\b/);
                  if (nextMatch && nextMatch[1]) {
                    numeroDocumento = nextMatch[1];
                    console.log('API - Número documento encontrado em próximo elemento:', numeroDocumento);
                    return false;
                  }
                }
              }
            }
          });
        }
        
        // Se ainda não encontrou, procurar no HTML completo
        if (!numeroDocumento) {
          const documentPatterns = [
            /Cupom\s*[Ff]iscal\s*[Ee]letrônico.*?(\d{6,9})/i,
            /SAT.*?(\d{6,9})/i,
            /NFCe.*?(\d{6,9})/i,
            /Extrato\s*(?:n[°º]|num|número)\s*(\d{6,9})/i,
            /NF[Ce]?\s*(?:n[°º]|num|número)\s*(\d{6,9})/i,
            /COO\s*[:]\s*(\d{6,9})/i,
            /ECF\s*[:]\s*(\d{6,9})/i,
            /Número\s*(?:do\s*)?(?:documento|cupom|nota)\s*[:]\s*(\d{6,9})/i,
            /\b(\d{9})\b/, // Números com exatamente 9 dígitos
            /\b(\d{8})\b/, // Números com exatamente 8 dígitos
            /\b(\d{7})\b/, // Números com exatamente 7 dígitos
            /\b(\d{6})\b/  // Números com exatamente 6 dígitos
          ];
          
          for (const pattern of documentPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
              numeroDocumento = match[1];
              console.log('API - Número documento encontrado com regex:', numeroDocumento);
              break;
            }
          }
        }
      }
      
      // 2. Procurar o valor do cupom fiscal (se ainda não encontrado no link ou na extração SEFAZ MG)
      if (!valor) {
        // Usando seletores específicos para valores em cupons fiscais
        $('.valor-total, .total-nota, .nfce-valor-total, .imposto-texto, .info-valor').each((_, el) => {
          const text = $(el).text().trim();
          const match = text.match(/R\$\s*([\d.,]+)/);
          if (match && match[1]) {
            valor = match[1].replace(/\./g, '').replace(',', '.');
            console.log('API - Valor encontrado em seletor específico:', valor);
            return false;
          }
        });
        
        // Se não encontrou com seletores específicos, procurar elementos com texto relacionado
        if (!valor) {
          $('*').each((_, el) => {
            if (valor) return false; // Já encontramos, sair
            
            const text = $(el).text().trim();
            
            // Verificar padrões específicos para o valor
            if (
              (text.includes('Total') || text.includes('TOTAL') || 
               text.includes('Valor') || text.includes('VALOR') ||
               text.includes('R$'))
            ) {
              // Tentar extrair da mesma linha/elemento
              const valorMatch = text.match(/R\$\s*([\d.,]+)/);
              if (valorMatch && valorMatch[1]) {
                valor = valorMatch[1].replace(/\./g, '').replace(',', '.');
                console.log('API - Valor encontrado em texto:', valor);
                return false;
              }
              
              // Procurar valor numérico direto (sem R$)
              if (!valor && /TOTAL|Total|VALOR|Valor/.test(text)) {
                const valorNumericoMatch = text.match(/[\d.,]+$/);
                if (valorNumericoMatch && valorNumericoMatch[0]) {
                  valor = valorNumericoMatch[0].replace(/\./g, '').replace(',', '.');
                  console.log('API - Valor numérico encontrado em texto:', valor);
                  return false;
                }
              }
              
              // Verificar no próximo elemento
              if (!valor) {
                const next = $(el).next();
                if (next.length) {
                  const nextText = next.text().trim();
                  const nextMatch = nextText.match(/R\$\s*([\d.,]+)|([\d.,]+)/);
                  if (nextMatch && (nextMatch[1] || nextMatch[2])) {
                    valor = (nextMatch[1] || nextMatch[2]).replace(/\./g, '').replace(',', '.');
                    console.log('API - Valor encontrado em próximo elemento:', valor);
                    return false;
                  }
                }
              }
              
              // Verificar elementos próximos dentro do mesmo pai
              if (!valor) {
                const parent = $(el).parent();
                parent.find('*').each((_, child) => {
                  if (valor || $(child).is(el)) return;
                  
                  const childText = $(child).text().trim();
                  const childMatch = childText.match(/R\$\s*([\d.,]+)|([\d.,]+)/);
                  if (childMatch && (childMatch[1] || childMatch[2])) {
                    valor = (childMatch[1] || childMatch[2]).replace(/\./g, '').replace(',', '.');
                    console.log('API - Valor encontrado em elemento irmão:', valor);
                    return false;
                  }
                });
              }
            }
          });
        }
        
        // Se ainda não encontrou o valor, procurar na página toda
        if (!valor) {
          const valorPatterns = [
            /VALOR\s*TOTAL\s*(?:R\$)?\s*([\d.,]+)/i,
            /TOTAL\s*(?:R\$)?\s*([\d.,]+)/i,
            /VALOR\s*PAGO\s*(?:R\$)?\s*([\d.,]+)/i,
            /VALOR\s*(?:R\$)?\s*([\d.,]+)/i,
            /TOTAL:?\s*(?:R\$)?\s*([\d.,]+)/i,
            /R\$\s*([\d.,]+)/i,
            /\b([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})\b/i // Padrão numérico com vírgula para decimais
          ];
          
          for (const pattern of valorPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
              // Garantir que o valor esteja no formato correto (ponto como separador decimal)
              valor = match[1].replace(/\./g, '').replace(',', '.');
              console.log('API - Valor encontrado com regex:', valor);
              break;
            }
          }
        }
      }
      
      // 3. Procurar a data de emissão (se ainda não encontrada no link ou na extração SEFAZ MG)
      if (!dataEmissao) {
        // Usando seletores específicos para datas em cupons fiscais
        $('.data-emissao, .nfce-data, .info-data, .data-nota').each((_, el) => {
          const text = $(el).text().trim();
          const match = text.match(/(\d{2}\/\d{2}\/\d{4})|(\d{2}\.\d{2}\.\d{4})|(\d{2}-\d{2}-\d{4})/);
          if (match) {
            dataEmissao = (match[1] || match[2] || match[3]).replace(/\./g, '/').replace(/-/g, '/');
            console.log('API - Data encontrada em seletor específico:', dataEmissao);
            return false;
          }
        });
        
        // Busca geral por datas
        if (!dataEmissao) {
          $('*').each((_, el) => {
            if (dataEmissao) return false; // Já encontramos, sair
            
            const text = $(el).text().trim();
            
            // Verificar padrões específicos para a data
            if (
              (text.includes('Data') || text.includes('DATA') || 
               text.includes('Emissão') || text.includes('EMISSÃO') ||
               text.includes('EMITIDO') || text.includes('Emitido'))
            ) {
              // Procurar no próprio texto
              const dataMatch = text.match(/(\d{2}\/\d{2}\/\d{4})|(\d{2}\.\d{2}\.\d{4})|(\d{2}-\d{2}-\d{4})/);
              if (dataMatch) {
                dataEmissao = (dataMatch[1] || dataMatch[2] || dataMatch[3]).replace(/\./g, '/').replace(/-/g, '/');
                console.log('API - Data encontrada em texto:', dataEmissao);
                return false;
              }
              
              // Verificar no próximo elemento
              const next = $(el).next();
              if (next.length) {
                const nextText = next.text().trim();
                const nextMatch = nextText.match(/(\d{2}\/\d{2}\/\d{4})|(\d{2}\.\d{2}\.\d{4})|(\d{2}-\d{2}-\d{4})/);
                if (nextMatch) {
                  dataEmissao = (nextMatch[1] || nextMatch[2] || nextMatch[3]).replace(/\./g, '/').replace(/-/g, '/');
                  console.log('API - Data encontrada em próximo elemento:', dataEmissao);
                  return false;
                }
              }
              
              // Verificar elementos próximos dentro do mesmo pai
              const parent = $(el).parent();
              parent.find('*').each((_, child) => {
                if (dataEmissao || $(child).is(el)) return;
                
                const childText = $(child).text().trim();
                const childMatch = childText.match(/(\d{2}\/\d{2}\/\d{4})|(\d{2}\.\d{2}\.\d{4})|(\d{2}-\d{2}-\d{4})/);
                if (childMatch) {
                  dataEmissao = (childMatch[1] || childMatch[2] || childMatch[3]).replace(/\./g, '/').replace(/-/g, '/');
                  console.log('API - Data encontrada em elemento irmão:', dataEmissao);
                  return false;
                }
              });
            }
          });
        }
        
        // Se ainda não encontrou a data, procurar na página toda
        if (!dataEmissao) {
          const dataPatterns = [
            /Data\s*(?:de)?\s*Emissão:?\s*(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
            /Emissão:?\s*(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
            /Data:?\s*(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
            /Emitido\s*(?:em|dia)?:?\s*(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i,
            /(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/i  // Qualquer data em formato DD/MM/AAAA
          ];
          
          for (const pattern of dataPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
              // Manter no formato DD/MM/YYYY para processamento posterior
              dataEmissao = match[1].replace(/\./g, '/').replace(/-/g, '/');
              console.log('API - Data encontrada com regex:', dataEmissao);
              break;
            }
          }
        }
      }
      
      // GARANTIA: Ao final de toda extração, garantir que numeroDocumento é o link original
      // Isso é crítico para o funcionamento correto das regras de negócio
      numeroDocumento = normalizedLink;
      console.log('API-DEBUG > Garantindo número do documento como link completo:', numeroDocumento);
      
      // Garantir que o valor, se extraído mas inválido, seja tratado
      if (valor) {
        try {
          // Tentar converter para número para verificar validade
          const valorNumerico = parseFloat(valor.replace(',', '.'));
          if (isNaN(valorNumerico) || valorNumerico <= 0) {
            console.log('API-DEBUG > Valor extraído inválido, removendo:', valor);
            valor = ''; // Valor inválido, melhor não enviar do que enviar errado
          } else {
            // Formatar com precisão de 2 casas decimais
            valor = valorNumerico.toFixed(2).replace('.', ',');
            console.log('API-DEBUG > Valor normalizado:', valor);
          }
        } catch (e) {
          console.log('API-DEBUG > Erro ao validar valor, removendo:', valor);
          valor = ''; // Em caso de erro, remover valor
        }
      }
      
      // Montar objeto com os resultados encontrados
      // IMPORTANTE: numeroDocumento DEVE ser o link completo
      const dados = {
        numeroDocumento, // Este é o link completo
        valor,
        dataEmissao
      };
      
      console.log('API-DEBUG > Dados extraídos finais (enviando para cliente):', JSON.stringify(dados));
      
      // Retornar os dados encontrados, mesmo que alguns estejam vazios
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
        
        // Se já tiver extraído algum dado do próprio link, retornar esses dados
        if (numeroDocumento || valor || dataEmissao) {
          console.log('API - Usando dados extraídos do link, pois houve timeout na requisição');
          return NextResponse.json({ numeroDocumento, valor, dataEmissao }, {
            status: 200,
            headers: responseHeaders,
          });
        }
        
        return NextResponse.json(
          { message: 'QR Code processado, sem dados extraídos' },
          { status: 200, headers: responseHeaders }
        );
      }

      console.error('API - Erro ao processar a página do cupom fiscal:', error);
      
      // Se já tiver extraído algum dado do próprio link, retornar esses dados
      if (numeroDocumento || valor || dataEmissao) {
        console.log('API - Usando dados extraídos do link, pois houve erro ao processar página');
        return NextResponse.json({ numeroDocumento, valor, dataEmissao }, {
          status: 200,
          headers: responseHeaders,
        });
      }
      
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