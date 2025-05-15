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
        // SEMPRE com o numeroDocumento sendo o link original
        if (numeroDocumento || valor || dataEmissao) {
          console.log('API - Usando dados extraídos do link, pois a página não pôde ser acessada');
          return NextResponse.json({ 
            numeroDocumento: originalLink || numeroDocumento, 
            valor, 
            dataEmissao 
          }, {
            status: 200,
            headers: responseHeaders,
          });
        }
        
        // Caso contrário, retornar mensagem sem dados
        return NextResponse.json(
          { 
            message: 'QR Code processado, sem dados extraídos',
            numeroDocumento: originalLink || numeroDocumento
          },
          { status: 200, headers: responseHeaders }
        );
      }
      
      // Obter o conteúdo da página
      const html = await response.text();
      console.log(`API - Página acessada com sucesso (${html.length} bytes)`);
      
      // Carregar o HTML com Cheerio para análise
      const $ = cheerio.load(html);
      
      // EXTRAÇÃO DIRETA ESPECÍFICA PARA SEFAZ MG - MELHORADA
      // ===================================================
      
      // TÉCNICA 1: Extrair diretamente elementos com texto relacionado a valor
      if (!valor) {
        try {
          console.log("API - Tentando extrair valor usando seletores diretos");
          
          // Array de seletores específicos que podem conter o valor total
          const valorSelectors = [
            '.valor-total', '.total-nota', '.nfce-valor-total', 
            '.imposto-texto', '.info-valor', '.totalNota',
            'span:contains("Valor Total")', 'span:contains("VALOR TOTAL")',
            'span:contains("Total R$")', 'span:contains("TOTAL R$")',
            'div:contains("Valor Total")', 'div:contains("VALOR TOTAL")',
            'td:contains("Valor Total")', 'td:contains("VALOR TOTAL")',
            'strong:contains("Valor Total")', 'strong:contains("VALOR TOTAL")',
            'strong:contains("Valor pago R$")', 'strong:contains("VALOR PAGO R$")',
            'strong:contains("Total:")', 'strong:contains("TOTAL:")',
            '.valor', '.total', '.valorTotal', '.totalNota', '.valorPago'
          ];
          
          // Tentar cada seletor e ver se encontra algo
          for (const selector of valorSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
              console.log(`API - Encontrado elemento com seletor: ${selector}`);
              
              // Para cada elemento encontrado, tentar extrair um valor
              elements.each((_, el) => {
                if (valor) return false; // Se já encontrou, sair do loop
                
                const text = $(el).text().trim();
                console.log(`API - Texto do elemento: "${text}"`);
                
                // Padrões para encontrar valores monetários em diferentes formatos
                const patterns = [
                  /R\$\s*([\d.,]+)/i,           // R$ seguido de números
                  /([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/,  // Formato brasileiro: 1.234,56
                  /([\d]{1,3}(?:,[\d]{3})*\.[\d]{2})/,  // Formato americano: 1,234.56
                  /([\d]+[,.][\d]{2})/          // Formato simples: 1234,56 ou 1234.56
                ];
                
                // Tentar cada padrão para extrair valor
                for (const pattern of patterns) {
                  const match = text.match(pattern);
                  if (match && match[1]) {
                    console.log(`API - Valor encontrado no texto: ${match[1]}`);
                    
                    // Normalizar para formato com ponto como separador decimal
                    let valorExtraido = match[1];
                    
                    // Se for formato brasileiro (com vírgula)
                    if (valorExtraido.includes(',')) {
                      valorExtraido = valorExtraido.replace(/\./g, '').replace(',', '.');
                    }
                    
                    // Tentar converter para número para validar
                    const valorNumerico = parseFloat(valorExtraido);
                    if (!isNaN(valorNumerico) && valorNumerico > 0) {
                      valor = valorExtraido;
                      console.log(`API - Valor extraído e normalizado: ${valor}`);
                      return false; // Sair do loop
                    }
                  }
                }
                
                // Se não encontrou com os padrões acima, procurar no próximo elemento
                const nextEl = $(el).next();
                if (nextEl.length) {
                  const nextText = nextEl.text().trim();
                  console.log(`API - Texto do próximo elemento: "${nextText}"`);
                  
                  // Tentar extrair valor do próximo elemento
                  for (const pattern of patterns) {
                    const match = nextText.match(pattern);
                    if (match && match[1]) {
                      let valorExtraido = match[1];
                      if (valorExtraido.includes(',')) {
                        valorExtraido = valorExtraido.replace(/\./g, '').replace(',', '.');
                      }
                      
                      const valorNumerico = parseFloat(valorExtraido);
                      if (!isNaN(valorNumerico) && valorNumerico > 0) {
                        valor = valorExtraido;
                        console.log(`API - Valor extraído do próximo elemento: ${valor}`);
                        return false; // Sair do loop
                      }
                    }
                  }
                }
              });
            }
            
            if (valor) break; // Se já encontrou valor, sair do loop principal
          }
        } catch (e) {
          console.warn('API - Erro ao tentar extrair valor usando seletores diretos:', e);
        }
      }
      
      // TÉCNICA 2: Extrair diretamente elementos com texto relacionado a data
      if (!dataEmissao) {
        try {
          console.log("API - Tentando extrair data usando seletores diretos");
          
          // Array de seletores específicos que podem conter a data
          const dataSelectors = [
            '.data-emissao', '.nfce-data', '.info-data', '.data-nota',
            'span:contains("Data de Emissão")', 'span:contains("DATA DE EMISSÃO")',
            'span:contains("Data Emissão")', 'span:contains("DATA EMISSÃO")',
            'div:contains("Data de Emissão")', 'div:contains("DATA DE EMISSÃO")',
            'td:contains("Data de Emissão")', 'td:contains("DATA DE EMISSÃO")',
            'strong:contains("Data")', 'strong:contains("DATA")',
            '.data', '.dataEmissao', '.emissao'
          ];
          
          // Padrões para reconhecer datas em diferentes formatos
          const dataPatterns = [
            /(\d{2}\/\d{2}\/\d{4})/,                 // DD/MM/YYYY
            /(\d{2}-\d{2}-\d{4})/,                   // DD-MM-YYYY
            /(\d{2}\.\d{2}\.\d{4})/,                 // DD.MM.YYYY
            /(\d{4}-\d{2}-\d{2})/,                   // YYYY-MM-DD
            /(\d{4}\/\d{2}\/\d{2})/,                 // YYYY/MM/DD
            /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/ // DD/MM/YYYY HH:MM:SS
          ];
          
          // Tentar cada seletor
          for (const selector of dataSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
              console.log(`API - Encontrado elemento com seletor: ${selector}`);
              
              // Para cada elemento encontrado, tentar extrair uma data
              elements.each((_, el) => {
                if (dataEmissao) return false; // Se já encontrou, sair do loop
                
                const text = $(el).text().trim();
                console.log(`API - Texto do elemento: "${text}"`);
                
                // Tentar cada padrão para extrair data
                for (const pattern of dataPatterns) {
                  const match = text.match(pattern);
                  if (match && match[1]) {
                    console.log(`API - Data encontrada no texto: ${match[1]}`);
                    
                    // Extrair apenas a parte da data (sem horas)
                    let dataExtraida = match[1];
                    
                    // Se contiver horas, remover
                    if (dataExtraida.includes(' ')) {
                      dataExtraida = dataExtraida.split(' ')[0];
                    }
                    
                    // Converter para o formato DD/MM/YYYY se estiver em outro formato
                    if (dataExtraida.match(/^\d{4}[-\/]\d{2}[-\/]\d{2}$/)) {
                      // Formato YYYY-MM-DD ou YYYY/MM/DD
                      const separador = dataExtraida.includes('-') ? '-' : '/';
                      const [ano, mes, dia] = dataExtraida.split(separador);
                      dataExtraida = `${dia}/${mes}/${ano}`;
                    } else if (dataExtraida.match(/^\d{2}[-\.]\d{2}[-\.]\d{4}$/)) {
                      // Formato DD-MM-YYYY ou DD.MM.YYYY
                      dataExtraida = dataExtraida.replace(/[-\.]/g, '/');
                    }
                    
                    // Validar se é uma data válida fazendo parse
                    const parts = dataExtraida.split('/');
                    if (parts.length === 3) {
                      const dia = parseInt(parts[0], 10);
                      const mes = parseInt(parts[1], 10) - 1; // Meses em JS são 0-11
                      const ano = parseInt(parts[2], 10);
                      
                      const dataObj = new Date(ano, mes, dia);
                      
                      if (dataObj.getFullYear() === ano && 
                          dataObj.getMonth() === mes && 
                          dataObj.getDate() === dia) {
                        dataEmissao = dataExtraida;
                        console.log(`API - Data extraída e normalizada: ${dataEmissao}`);
                        return false; // Sair do loop
                      }
                    }
                  }
                }
                
                // Se não encontrou com os padrões acima, procurar no próximo elemento
                const nextEl = $(el).next();
                if (nextEl.length) {
                  const nextText = nextEl.text().trim();
                  console.log(`API - Texto do próximo elemento: "${nextText}"`);
                  
                  // Tentar extrair data do próximo elemento
                  for (const pattern of dataPatterns) {
                    const match = nextText.match(pattern);
                    if (match && match[1]) {
                      let dataExtraida = match[1];
                      
                      // Mesmo processamento de data do bloco anterior
                      if (dataExtraida.includes(' ')) {
                        dataExtraida = dataExtraida.split(' ')[0];
                      }
                      
                      if (dataExtraida.match(/^\d{4}[-\/]\d{2}[-\/]\d{2}$/)) {
                        const separador = dataExtraida.includes('-') ? '-' : '/';
                        const [ano, mes, dia] = dataExtraida.split(separador);
                        dataExtraida = `${dia}/${mes}/${ano}`;
                      } else if (dataExtraida.match(/^\d{2}[-\.]\d{2}[-\.]\d{4}$/)) {
                        dataExtraida = dataExtraida.replace(/[-\.]/g, '/');
                      }
                      
                      const parts = dataExtraida.split('/');
                      if (parts.length === 3) {
                        const dia = parseInt(parts[0], 10);
                        const mes = parseInt(parts[1], 10) - 1;
                        const ano = parseInt(parts[2], 10);
                        
                        const dataObj = new Date(ano, mes, dia);
                        
                        if (dataObj.getFullYear() === ano && 
                            dataObj.getMonth() === mes && 
                            dataObj.getDate() === dia) {
                          dataEmissao = dataExtraida;
                          console.log(`API - Data extraída do próximo elemento: ${dataEmissao}`);
                          return false; // Sair do loop
                        }
                      }
                    }
                  }
                }
              });
            }
            
            if (dataEmissao) break; // Se já encontrou data, sair do loop principal
          }
        } catch (e) {
          console.warn('API - Erro ao tentar extrair data usando seletores diretos:', e);
        }
      }
      
      // TÉCNICA 3: Pesquisa agressiva em todo o HTML por padrões de data e valor
      if (!valor || !dataEmissao) {
        try {
          console.log("API - Iniciando pesquisa agressiva no HTML completo");
          
          // Extrair todas as strings que possam conter valores monetários
          if (!valor) {
            const valorMatches = html.match(/R\$\s*([\d.,]+)/g) || 
                                html.match(/([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/g) ||
                                html.match(/([\d]+,[\d]{2})/g);
                                
            if (valorMatches && valorMatches.length > 0) {
              console.log(`API - Encontrados ${valorMatches.length} possíveis valores no HTML`);
              
              // Filtrar apenas valores que parecem ser "totais" (geralmente os maiores)
              const valoresNumericos = valorMatches.map(match => {
                // Extrair apenas o número
                const numMatch = match.match(/R\$\s*([\d.,]+)/) || 
                               match.match(/([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/) ||
                               match.match(/([\d]+,[\d]{2})/);
                               
                if (numMatch && numMatch[1]) {
                  // Normalizar para formato com ponto como separador decimal
                  let valorStr = numMatch[1].replace(/\./g, '').replace(',', '.');
                  return parseFloat(valorStr);
                }
                return 0;
              }).filter(num => num > 0);
              
              if (valoresNumericos.length > 0) {
                // Ordenar valores do maior para o menor
                valoresNumericos.sort((a, b) => b - a);
                
                // O valor total geralmente é o maior valor na página
                const maiorValor = valoresNumericos[0];
                console.log(`API - Maior valor encontrado na página: ${maiorValor}`);
                
                valor = maiorValor.toString();
              }
            }
          }
          
          // Extrair todas as strings que possam conter datas
          if (!dataEmissao) {
            const dataMatches = html.match(/\d{2}\/\d{2}\/\d{4}/g) || 
                               html.match(/\d{2}-\d{2}-\d{4}/g) ||
                               html.match(/\d{2}\.\d{2}\.\d{4}/g);
                               
            if (dataMatches && dataMatches.length > 0) {
              console.log(`API - Encontradas ${dataMatches.length} possíveis datas no HTML`);
              
              // Verificar no texto ao redor dessas datas por palavras-chave
              for (const dataTexto of dataMatches) {
                // Se encontrar "Data", "Emissão", etc. próximo à data, é provável que seja a data de emissão
                const indexData = html.indexOf(dataTexto);
                const textoAoRedor = html.substring(Math.max(0, indexData - 50), Math.min(html.length, indexData + 50));
                
                if (/data|emissão|emitido|emitida/i.test(textoAoRedor)) {
                  console.log(`API - Data encontrada com contexto de emissão: ${dataTexto}`);
                  dataEmissao = dataTexto.replace(/[-\.]/g, '/');
                  break;
                }
              }
              
              // Se não encontrou com contexto, usar a primeira data
              if (!dataEmissao && dataMatches.length > 0) {
                dataEmissao = dataMatches[0].replace(/[-\.]/g, '/');
                console.log(`API - Usando primeira data encontrada: ${dataEmissao}`);
              }
            }
          }
        } catch (e) {
          console.warn('API - Erro na pesquisa agressiva:', e);
        }
      }
      
      // GARANTIA: Ao final de toda extração, garantir que numeroDocumento é o link original
      // Isso é crítico para o funcionamento correto das regras de negócio
      numeroDocumento = originalLink || numeroDocumento;
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
          return NextResponse.json({ 
            numeroDocumento: originalLink || numeroDocumento, 
            valor, 
            dataEmissao 
          }, {
            status: 200,
            headers: responseHeaders,
          });
        }
        
        return NextResponse.json(
          { 
            message: 'QR Code processado, sem dados extraídos',
            numeroDocumento: originalLink || numeroDocumento
          },
          { status: 200, headers: responseHeaders }
        );
      }

      console.error('API - Erro ao processar a página do cupom fiscal:', error);
      
      // Se já tiver extraído algum dado do próprio link, retornar esses dados
      if (numeroDocumento || valor || dataEmissao) {
        console.log('API - Usando dados extraídos do link, pois houve erro ao processar página');
        return NextResponse.json({ 
          numeroDocumento: originalLink || numeroDocumento, 
          valor, 
          dataEmissao 
        }, {
          status: 200,
          headers: responseHeaders,
        });
      }
      
      // Retornar um objeto para evitar erro, mesmo que sem dados
      return NextResponse.json(
        { 
          message: 'QR Code processado, sem dados extraídos',
          numeroDocumento: originalLink || numeroDocumento
        },
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