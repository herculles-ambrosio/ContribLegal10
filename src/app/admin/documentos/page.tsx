'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaCheck, FaTimes, FaClock, FaSearch, FaFilter, FaEye, FaExclamationCircle, FaDownload } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { Documento } from '@/types/supabase';
import AdminLayout from '@/components/AdminLayout';
import { getUsuarioLogado } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Função para criar cliente do Supabase com opções específicas para admin
const criarClienteAdmin = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Variáveis de ambiente do Supabase não configuradas');
    return null;
  }
  
  try {
    // Utilizamos o cliente padrão, mas com as credenciais do usuário logado
    // que já possui as permissões de admin verificadas
    return supabase;
  } catch (error) {
    console.error('Erro ao criar cliente admin:', error);
    return null;
  }
};

// Extendendo o tipo Documento para incluir a propriedade usuarios
type DocumentoComUsuario = Documento & {
  usuarios?: {
    nome_completo: string;
    email: string;
    cpf_cnpj: string;
  };
  
  // Propriedades adicionais que podem estar presentes no documento
  contribuinte?: string;
  cpf_cnpj?: string;
  url_documento?: string;
  arquivo_url?: string;
  numero_documento?: string;
  chave_acesso?: string;
  identificador?: string;
  descricao?: string;
  tipo?: string;
  valor?: string | number;
  status?: string;
  data_validacao?: string | null;
};

/**
 * Gerenciamento de Documentos - Visualização e gerenciamento de todos os documentos
 */
export default function DocumentosAdmin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [documentos, setDocumentos] = useState<DocumentoComUsuario[]>([]);
  const [documentosFiltrados, setDocumentosFiltrados] = useState<DocumentoComUsuario[]>([]);
  const [operacaoEmAndamento, setOperacaoEmAndamento] = useState(false);
  const [totalDocumentos, setTotalDocumentos] = useState(0);
  const [valorTotalDocumentos, setValorTotalDocumentos] = useState(0);
  const [totalValidados, setTotalValidados] = useState(0);
  const [totalAguardandoValidacao, setTotalAguardandoValidacao] = useState(0);
  const [totalInvalidados, setTotalInvalidados] = useState(0);
  
  // Filtros para aba Documentos
  const [filtroContribuinte, setFiltroContribuinte] = useState<string>('');
  const [filtroTipoDocumento, setFiltroTipoDocumento] = useState<string>('');
  const [filtroCpfCnpj, setFiltroCpfCnpj] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  
  useEffect(() => {
    const verificarUsuarioMaster = async () => {
      try {
        // Obter informações do usuário logado
        const usuario = await getUsuarioLogado();
        
        if (!usuario) {
          router.push('/login');
          return;
        }
        
        // Verificação específica do campo master
        if (usuario.master !== 'S') {
          router.push('/dashboard');
          return;
        }
        
        // Carregar dados com ID do usuário logado (admin)
        await carregarDocumentos();
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        router.push('/dashboard');
      }
    };
    
    verificarUsuarioMaster();
  }, [router]);
  
  // Função auxiliar para usar queries SQL diretamente se permitido
  const executarQueryDireta = async (adminClient: any, query: string) => {
    try {
      // Verificar se é uma operação de UPDATE, INSERT ou DELETE
      const isUpdate = query.trim().toLowerCase().startsWith('update') || 
                       query.trim().toLowerCase().startsWith('insert') || 
                       query.trim().toLowerCase().startsWith('delete');
      
      // Para operações de atualização, queremos saber apenas se foi bem-sucedida
      if (isUpdate) {
        try {
          // Usando chamada RPC para executar update
          const { data, error } = await adminClient.rpc('executar_query_admin', {
            query_sql: query
          });
          
          if (error) {
            console.error('Erro ao executar query de atualização via RPC:', error);
            return false;
          }
          
          // Se não houve erro, a operação foi bem-sucedida
          return true;
        } catch (rpcError) {
          console.error('Exceção ao executar query de atualização via RPC:', rpcError);
          return false;
        }
      }
      
      // Para operações SELECT, vamos tentar usar a API do Supabase diretamente
      // em vez de depender da função RPC que está causando erros
      try {
        // Determinar tabela a consultar com base na query
        if (query.toLowerCase().includes('from documentos')) {
          const { data, error } = await adminClient
            .from('documentos')
            .select(`
              *,
              usuarios (
                nome_completo,
                email,
                cpf_cnpj
              )
            `)
            .order('created_at', { ascending: false });
          
          if (error) {
            console.error('Erro ao consultar documentos via API:', error);
            return null;
          }
          
          return data;
        } else if (query.toLowerCase().includes('from faixas_numero_sorte')) {
          const { data, error } = await adminClient
            .from('faixas_numero_sorte')
            .select('*')
            .order('valor_de', { ascending: true });
          
          if (error) {
            console.error('Erro ao consultar faixas via API:', error);
            return null;
          }
          
          return data;
        } else {
          console.error('Tabela não suportada para consulta direta:', query);
          return null;
        }
      } catch (selectError) {
        console.error('Exceção ao executar consulta via API:', selectError);
        return null;
      }
    } catch (error) {
      console.error('Erro geral ao executar query:', error);
      return null;
    }
  };
  
  const extrairTabelaDoSQL = (query: string): string | null => {
    const fromMatch = query.match(/from\s+([^\s,;]+)/i);
    if (fromMatch && fromMatch.length > 1) {
      return fromMatch[1].replace(/['"]/g, '').trim();
    }
    return null;
  };
  
  // Função para carregar dados da tabela documentos
  const carregarDocumentos = async () => {
    try {
      setIsLoading(true);
      
      // Criar cliente admin para ignorar RLS
      const adminClient = await criarClienteAdmin();
      
      // Tentar carregar documentos diretamente com a API do Supabase
      const { data: documentosData, error: documentosError } = await adminClient
        .from('documentos')
        .select(`
          *,
          usuarios (
            nome_completo,
            email,
            cpf_cnpj
          )
        `)
        .order('created_at', { ascending: false });
        
      if (documentosError) {
        console.error('Erro ao carregar documentos:', documentosError);
        toast.error('Erro ao carregar dados de documentos');
        setIsLoading(false);
        return;
      }
      
      // Processar dados recebidos
      if (documentosData && documentosData.length > 0) {
        setDocumentos(documentosData);
        setDocumentosFiltrados(documentosData);
        setTotalDocumentos(documentosData.length);
        
        // Calcular total por status
        const validados = documentosData.filter((d: DocumentoComUsuario) => d.status === 'VALIDADO');
        const aguardando = documentosData.filter((d: DocumentoComUsuario) => d.status === 'AGUARDANDO VALIDAÇÃO');
        const invalidados = documentosData.filter((d: DocumentoComUsuario) => d.status === 'INVÁLIDO');
        
        setTotalValidados(validados.length);
        setTotalAguardandoValidacao(aguardando.length);
        setTotalInvalidados(invalidados.length);
        
        // Calcular valor total dos documentos
        const valorTotal = documentosData.reduce((acc: number, doc: DocumentoComUsuario) => {
          const valor = parseFloat(doc.valor?.toString() || '0');
          return acc + (isNaN(valor) ? 0 : valor);
        }, 0);
        setValorTotalDocumentos(valorTotal);
        
        toast.success(`${documentosData.length} documentos carregados com sucesso`);
      } else {
        console.warn('Nenhum documento encontrado ou retornado');
        toast.error('Nenhum documento encontrado');
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do painel administrativo');
      setIsLoading(false);
    }
  };
  
  // Filtragem de documentos
  useEffect(() => {
    const filtragemDocumentos = () => {
      if (!documentos || documentos.length === 0) return;
      
      let resultado = [...documentos];
      
      if (filtroContribuinte) {
        resultado = resultado.filter(d => 
          d.contribuinte?.toLowerCase().includes(filtroContribuinte.toLowerCase()) ||
          d.usuarios?.nome_completo?.toLowerCase().includes(filtroContribuinte.toLowerCase())
        );
      }
      
      if (filtroTipoDocumento) {
        resultado = resultado.filter(d => d.tipo === filtroTipoDocumento);
      }
      
      if (filtroCpfCnpj) {
        resultado = resultado.filter(d => 
          d.cpf_cnpj?.includes(filtroCpfCnpj) ||
          d.usuarios?.cpf_cnpj?.includes(filtroCpfCnpj)
        );
      }
      
      if (filtroStatus) {
        resultado = resultado.filter(d => d.status === filtroStatus);
      }
      
      setDocumentosFiltrados(resultado);
    };
    
    filtragemDocumentos();
  }, [documentos, filtroContribuinte, filtroTipoDocumento, filtroCpfCnpj, filtroStatus]);
  
  // Limpar filtros
  const limparFiltros = () => {
    setFiltroContribuinte('');
    setFiltroTipoDocumento('');
    setFiltroCpfCnpj('');
    setFiltroStatus('');
  };
  
  // Função para buscar a faixa de números da sorte com base no valor do documento
  const buscarFaixaNumeroSorte = async (valor: number): Promise<any> => {
    try {
      console.log(`Buscando faixa para o valor: ${valor}`);
      
      // Corrigir a lógica dos operadores:
      // Valor deve estar entre valor_de e valor_ate, ou seja:
      // valor >= valor_de e valor <= valor_ate
      const { data, error } = await supabase
        .from('faixas_numero_sorte')
        .select('*')
        .lte('valor_de', valor)  // valor_de <= valor
        .gte('valor_ate', valor); // valor_ate >= valor
      
      if (error) {
        console.error('Erro ao buscar faixa:', error);
        return null;
      }
      
      if (!data || data.length === 0) {
        console.log(`Nenhuma faixa encontrada para o valor ${valor}`);
        return null;
      }
      
      console.log('Faixa encontrada:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Erro ao buscar faixa:', error);
      return null;
    }
  };
  
  // Gerar números da sorte para um documento
  const gerarNumerosSorte = async (documentoId: string, valorDocumento: number): Promise<boolean> => {
    try {
      console.log(`Gerando números da sorte para documento ${documentoId} com valor ${valorDocumento}`);
      
      // Verificar se já existem números da sorte para este documento
      const { data: numerosExistentes, error: checkError } = await supabase
        .from('numeros_sorte_documento')
        .select('numero_sorte')
        .eq('documento_id', documentoId);
      
      if (checkError) {
        console.error('Erro ao verificar números da sorte existentes:', checkError);
        toast.error('Erro ao verificar números da sorte existentes');
        return false;
      }
      
      if (numerosExistentes && numerosExistentes.length > 0) {
        console.log(`Documento já possui ${numerosExistentes.length} números da sorte`);
        toast.success(`Documento já possui ${numerosExistentes.length} números da sorte`);
        return true;
      }
      
      // Buscar a faixa de números da sorte
      const faixa = await buscarFaixaNumeroSorte(valorDocumento);
      if (!faixa) {
        console.error(`Faixa de valor não encontrada para valor ${valorDocumento}`);
        toast.error(`Faixa de valor não encontrada para geração de números`);
        return false;
      }
      
      console.log(`Faixa encontrada: ${faixa.valor_de} a ${faixa.valor_ate}, quantidade: ${faixa.quantidade_numeros}`);
      
      // Quantidade de números a gerar de acordo com a faixa
      const quantidadeNumeros = faixa.quantidade_numeros || 1;
      console.log(`Quantidade de números a gerar: ${quantidadeNumeros}`);
      
      // Obter todos os números da sorte já utilizados para evitar duplicidade
      const { data: todosNumeros, error: numerosTotaisError } = await supabase
        .from('numeros_sorte_documento')
        .select('numero_sorte');
      
      if (numerosTotaisError) {
        console.error('Erro ao buscar números da sorte existentes:', numerosTotaisError);
        toast.error('Erro ao verificar números da sorte disponíveis');
        return false;
      }
      
      // Criar conjunto de números já utilizados para verificação mais rápida
      const numerosUtilizados = new Set();
      if (todosNumeros && Array.isArray(todosNumeros)) {
        todosNumeros.forEach(item => {
          if (item && item.numero_sorte) {
            numerosUtilizados.add(item.numero_sorte);
          }
        });
      }
      console.log(`Já existem ${numerosUtilizados.size} números de sorte utilizados no sistema`);
      
      // Gerar números da sorte únicos
      const numerosSorteGerados: string[] = [];
      
      // Aumentar o número máximo de tentativas para garantir que consigamos gerar todos os números necessários
      // 100 tentativas para cada número a ser gerado
      const maxTentativas = quantidadeNumeros * 100;
      let tentativas = 0;
      
      while (numerosSorteGerados.length < quantidadeNumeros && tentativas < maxTentativas) {
        tentativas++;
        
        // Gerar um número aleatório EXATAMENTE com 6 dígitos (100000 a 999999)
        const numeroSorte = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Verificar se o número já foi utilizado
        if (!numerosUtilizados.has(numeroSorte) && !numerosSorteGerados.includes(numeroSorte)) {
          numerosSorteGerados.push(numeroSorte);
          numerosUtilizados.add(numeroSorte); // Adicionar ao conjunto para não gerar duplicados nas próximas iterações
        }
        
        // Log a cada 50 tentativas para debug
        if (tentativas % 50 === 0) {
          console.log(`${tentativas} tentativas realizadas, ${numerosSorteGerados.length}/${quantidadeNumeros} números gerados`);
        }
      }
      
      if (numerosSorteGerados.length < quantidadeNumeros) {
        console.error(`Não foi possível gerar todos os ${quantidadeNumeros} números da sorte únicos. Apenas ${numerosSorteGerados.length} gerados.`);
        toast.error(`Não foi possível gerar todos os números da sorte únicos (${numerosSorteGerados.length}/${quantidadeNumeros})`);
        if (numerosSorteGerados.length === 0) {
          return false;
        }
      }
      
      console.log(`Números gerados (${numerosSorteGerados.length}): ${numerosSorteGerados.join(', ')}`);
      
      // Inserir números da sorte no banco de dados
      let sucessos = 0;
      for (const numeroSorte of numerosSorteGerados) {
        const { error: insertError } = await supabase
          .from('numeros_sorte_documento')
          .insert({
            documento_id: documentoId,
            numero_sorte: numeroSorte
          });
        
        if (insertError) {
          console.error('Erro ao inserir número da sorte:', insertError);
          toast.error(`Erro ao inserir número da sorte: ${numeroSorte}`);
        } else {
          sucessos++;
        }
      }
      
      if (sucessos > 0) {
        toast.success(`${sucessos} número(s) da sorte gerado(s) com sucesso`);
        return true;
      } else {
        toast.error('Falha ao inserir números da sorte no banco de dados');
        return false;
      }
    } catch (error) {
      console.error('Erro ao gerar números da sorte:', error);
      toast.error(`Erro ao gerar números da sorte: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };
  
  // Atualizar status de documento
  const atualizarStatusDocumento = async (id: string, status: 'VALIDADO' | 'INVÁLIDO' | 'AGUARDANDO VALIDAÇÃO') => {
    try {
      setOperacaoEmAndamento(true);
      console.log(`Atualizando status do documento ${id} para: ${status}`);
      
      // Obter o documento atual
      const documentoAtual = documentos.find(d => d.id === id);
      if (!documentoAtual) {
        console.error(`Documento com ID ${id} não encontrado`);
        toast.error('Documento não encontrado');
        setOperacaoEmAndamento(false);
        return;
      }
      
      const statusAnterior = documentoAtual.status;
      console.log(`Status anterior: ${statusAnterior}`);

      // Atualização direta - mais simples possível
      const updateResult = await supabase
        .from('documentos')
        .update({ status })
        .eq('id', id);
      
      if (updateResult.error) {
        console.error('Erro na atualização de status:', updateResult.error);
        toast.error(`Erro ao atualizar status: ${updateResult.error.message}`);
        setOperacaoEmAndamento(false);
        return;
      }
      
      console.log('Status atualizado com sucesso!');
      
      // Se o status for alterado para VALIDADO, gerar números da sorte
      if (status === 'VALIDADO' && statusAnterior !== 'VALIDADO') {
        console.log(`Gerando números da sorte para o documento ${id}`);
        
        if (documentoAtual.valor) {
          const valorDocumento = parseFloat(documentoAtual.valor.toString().replace(',', '.'));
          
          if (!isNaN(valorDocumento) && valorDocumento > 0) {
            await gerarNumerosSorte(id, valorDocumento);
          } else {
            toast.error('Valor do documento inválido');
          }
        } else {
          toast.error('Documento sem valor definido');
        }
      }
      
      // Se estiver INVALIDANDO um documento que estava VALIDADO, deletar os números da sorte
      if (status === 'INVÁLIDO' && statusAnterior === 'VALIDADO') {
        const deleteResult = await supabase
          .from('numeros_sorte_documento')
          .delete()
          .eq('documento_id', id);
        
        if (deleteResult.error) {
          console.error('Erro ao excluir números da sorte:', deleteResult.error);
        } else {
          console.log(`Números da sorte excluídos para o documento ${id}`);
          toast.success('Números da sorte removidos');
        }
      }
      
      // Atualizar a lista local
      const documentosAtualizados = documentos.map(doc => {
        if (doc.id === id) {
          return { 
            ...doc, 
            status
          };
        }
        return doc;
      });
      
      setDocumentos(documentosAtualizados);
      
      // Aplicar os filtros atuais nos documentos atualizados
      const novosFiltrados = aplicarFiltros(documentosAtualizados);
      setDocumentosFiltrados(novosFiltrados);
      
      // Atualizar contadores para refletir a mudança
      atualizarContadores(documentosAtualizados);
      
      toast.success(`Status do documento atualizado para ${status}`);
      
      // Recarregar documentos para garantir dados atualizados
      await carregarDocumentos();
    } catch (error) {
      console.error('Erro ao atualizar status do documento:', error);
      toast.error(`Erro ao atualizar status do documento: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setOperacaoEmAndamento(false);
    }
  };
  
  // Função auxiliar para aplicar filtros
  const aplicarFiltros = (docs: DocumentoComUsuario[]): DocumentoComUsuario[] => {
    let filtrados = [...docs];
    
    if (filtroContribuinte) {
      filtrados = filtrados.filter(d => 
        (d.usuarios?.nome_completo || '').toLowerCase().includes(filtroContribuinte.toLowerCase())
      );
    }
    
    if (filtroCpfCnpj) {
      filtrados = filtrados.filter(d => 
        (d.usuarios?.cpf_cnpj || '').toLowerCase().includes(filtroCpfCnpj.toLowerCase()) ||
        (d.cpf_cnpj || '').toLowerCase().includes(filtroCpfCnpj.toLowerCase())
      );
    }
    
    if (filtroTipoDocumento) {
      filtrados = filtrados.filter(d => 
        (d.tipo || '').toLowerCase().includes(filtroTipoDocumento.toLowerCase())
      );
    }
    
    if (filtroStatus) {
      filtrados = filtrados.filter(d => d.status === filtroStatus);
    }
    
    return filtrados;
  };
  
  // Função para atualizar os contadores
  const atualizarContadores = (docs: DocumentoComUsuario[]) => {
    const validados = docs.filter(d => d.status === 'VALIDADO').length;
    const aguardando = docs.filter(d => d.status === 'AGUARDANDO VALIDAÇÃO').length;
    const invalidados = docs.filter(d => d.status === 'INVÁLIDO').length;
    
    setTotalValidados(validados);
    setTotalAguardandoValidacao(aguardando);
    setTotalInvalidados(invalidados);
  };
  
  // Função auxiliar para formatação de valores monetários em reais
  const formatarMoeda = (valor: string | number | null) => {
    if (valor === null || valor === undefined) return 'R$ 0,00';
    const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
    if (isNaN(numero)) return 'R$ 0,00';
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numero);
  };
  
  // Obter label do tipo de documento
  const getTipoDocumentoLabel = (tipo: string) => {
    const tiposDocumento: Record<string, string> = {
      'NF': 'Nota Fiscal',
      'CUPOM_FISCAL': 'Cupom Fiscal',
      'RECIBO': 'Recibo',
      'BOLETO': 'Boleto',
      'FATURA': 'Fatura',
      'OUTRO': 'Outro'
    };
    
    return tiposDocumento[tipo] || tipo;
  };
  
  // Função auxiliar para formatar data corretamente preservando o dia
  const formatarDataSemTimezone = (dataString: string) => {
    try {
      if (!dataString) return '';
      
      // Se a data vier em formato ISO, vamos preservar o dia exato
      if (dataString.includes('T')) {
        const [dataParte] = dataString.split('T');
        const [ano, mes, dia] = dataParte.split('-').map(num => parseInt(num, 10));
        if (ano && mes && dia) {
          return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
        }
      }
      
      // Se for apenas data (YYYY-MM-DD), dividimos e montamos diretamente
      if (dataString.includes('-') && dataString.split('-').length === 3) {
        const [ano, mes, dia] = dataString.split('-').map(num => parseInt(num, 10));
        if (ano && mes && dia) {
          return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
        }
      }
      
      // Fallback para o método padrão (que pode ter o problema de timezone)
      return new Date(dataString).toLocaleDateString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data:', error, dataString);
      return dataString; // Retornar a string original em caso de erro
    }
  };
  
  // Visualizar documento
  const visualizarDocumento = async (id: string, documento: DocumentoComUsuario) => {
    try {
      if (!documento) {
        toast.error('Documento não encontrado');
        return;
      }
      
      // Determinar qual URL usar com base no tipo de documento
      let urlParaAbrir = '';
      
      if (documento.tipo && documento.tipo.toUpperCase().includes('CUPOM')) {
        // Para cupom fiscal, usar o número do documento como link
        if (documento.numero_documento) {
          urlParaAbrir = documento.numero_documento;
          
          // Verificar se o link do CUPOM FISCAL já é uma URL válida
          if (!urlParaAbrir.startsWith('http://') && !urlParaAbrir.startsWith('https://')) {
            // Adicionar https:// apenas se parecer uma URL sem protocolo
            if (urlParaAbrir.includes('.') || urlParaAbrir.includes('/')) {
              urlParaAbrir = `https://${urlParaAbrir}`;
            }
          }
          
          console.log(`Abrindo cupom fiscal com link: ${urlParaAbrir}`);
        } else {
          toast.error('Link do cupom fiscal não encontrado');
          return;
        }
      } else {
        // Para outros tipos (NOTA DE SERVIÇO, IMPOSTO, etc.), usar arquivo_url
        if (documento.arquivo_url) {
          console.log(`Tentando acessar arquivo: ${documento.arquivo_url}`);
          
          // Verificar se o arquivo_url está em um formato válido
          if (!documento.arquivo_url.trim()) {
            toast.error('Caminho do arquivo vazio ou inválido');
            return;
          }
          
          try {
            // SOLUÇÃO ALTERNATIVA:
            // Em vez de tentar criar URL assinada diretamente, primeiro verificamos se o 
            // objeto existe, e se não existir, tentamos construir um URL público
            
            // Extrair o nome do arquivo do caminho completo
            let caminhoArquivo = documento.arquivo_url;
            
            // Tentar extrair apenas o nome do arquivo se for um caminho completo
            if (caminhoArquivo.includes('/')) {
              const partesDoCaminho = caminhoArquivo.split('/');
              const nomeArquivo = partesDoCaminho[partesDoCaminho.length - 1];
              
              // Verificar se temos apenas o nome do arquivo ou se temos um subdiretório
              // Se tivermos o ID do usuário (UUID) como parte do caminho, ele deve ser mantido
              const possívelUsuarioId = partesDoCaminho.length > 1 ? partesDoCaminho[0] : null;
              
              if (possívelUsuarioId && possívelUsuarioId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                // Temos um UUID como primeira parte do caminho (provavelmente user_id)
                caminhoArquivo = `${possívelUsuarioId}/${nomeArquivo}`;
              } else {
                // Se não tivermos um UUID, tentar apenas com o nome do arquivo
                caminhoArquivo = nomeArquivo;
              }
              
              console.log(`Caminho processado: ${caminhoArquivo}`);
            }
            
            // Primeiro, tentar gerar uma URL pública para o arquivo (não requer autenticação)
            const { data: publicUrlData } = supabase.storage
              .from('documentos')
              .getPublicUrl(caminhoArquivo);
            
            if (publicUrlData && publicUrlData.publicUrl) {
              // Verificar se o arquivo existe fazendo uma requisição HEAD
              try {
                const resposta = await fetch(publicUrlData.publicUrl, { method: 'HEAD' });
                if (resposta.ok) {
                  // O arquivo existe! Podemos usar a URL pública
                  urlParaAbrir = publicUrlData.publicUrl;
                  console.log(`Usando URL pública: ${urlParaAbrir}`);
                } else {
                  // Arquivo não encontrado, tentar gerar URL assinada como fallback
                  throw new Error('Arquivo não encontrado com URL pública');
                }
              } catch (fetchError) {
                console.log('Erro ao verificar URL pública, tentando URL assinada', fetchError);
                
                // Tentar com URL assinada como fallback
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                  .from('documentos')
                  .createSignedUrl(caminhoArquivo, 60);
                
                if (signedUrlError) {
                  // Se ainda tivermos erro com o caminho atual, tentar outras alternativas:
                  
                  // 1. Tentar apenas com o nome do arquivo (sem subdiretórios)
                  if (caminhoArquivo.includes('/')) {
                    const nomeArquivoSimples = caminhoArquivo.split('/').pop() || '';
                    console.log(`Tentando com nome de arquivo simples: ${nomeArquivoSimples}`);
                    
                    const { data: altData, error: altError } = await supabase.storage
                      .from('documentos')
                      .createSignedUrl(nomeArquivoSimples, 60);
                    
                    if (!altError && altData) {
                      urlParaAbrir = altData.signedUrl;
                      console.log(`URL assinada com nome simples: ${urlParaAbrir}`);
                    } else {
                      console.error('Erro ao gerar URL assinada alternativa:', altError);
                      throw new Error(`Arquivo não encontrado no armazenamento: ${nomeArquivoSimples}`);
                    }
                  } else {
                    console.error('Erro ao gerar URL assinada:', signedUrlError);
                    throw new Error(`Arquivo não encontrado no armazenamento: ${caminhoArquivo}`);
                  }
                } else if (signedUrlData) {
                  urlParaAbrir = signedUrlData.signedUrl;
                  console.log(`URL assinada gerada: ${urlParaAbrir}`);
                }
              }
            }
          } catch (storageError) {
            console.error('Erro ao processar arquivo:', storageError);
            
            // Se tudo falhar, tentar url_documento como última alternativa
            if (documento.url_documento) {
              console.log('Usando url_documento como alternativa');
              urlParaAbrir = documento.url_documento;
            } else {
              toast.error(`Não foi possível localizar o arquivo. ID do documento: ${id}`);
              return;
            }
          }
        } else if (documento.url_documento) {
          // Fallback para url_documento
          urlParaAbrir = documento.url_documento;
          console.log(`Abrindo URL alternativa de documento: ${urlParaAbrir}`);
        } else {
          toast.error('Nenhum arquivo disponível para este documento');
          return;
        }
      }
      
      // Abrir URL em uma nova aba
      if (urlParaAbrir) {
        window.open(urlParaAbrir, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('URL inválida para visualização do documento');
      }
    } catch (error) {
      console.error('Erro ao visualizar documento:', error);
      if (error instanceof Error) {
        console.error('Detalhes do erro:', error.message, error.stack);
        toast.error(`Erro: ${error.message}`);
      } else {
        toast.error('Erro ao abrir documento. Verifique o console para detalhes.');
      }
    }
  };
  
  // Validar documento
  const validarDocumento = (id: string) => {
    atualizarStatusDocumento(id, 'VALIDADO');
  };
  
  // Invalidar documento
  const invalidarDocumento = (id: string) => {
    atualizarStatusDocumento(id, 'INVÁLIDO');
  };
  
  // Marcar como aguardando validação
  const aguardarValidacao = (id: string) => {
    atualizarStatusDocumento(id, 'AGUARDANDO VALIDAÇÃO');
  };
  
  // Renderizar badge de status
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'VALIDADO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <FaCheck className="w-3 h-3 mr-1" /> Validado
          </span>
        );
      case 'INVÁLIDO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <FaTimes className="w-3 h-3 mr-1" /> Inválido
          </span>
        );
      case 'AGUARDANDO VALIDAÇÃO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <FaClock className="w-3 h-3 mr-1" /> Aguardando
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };
  
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-4 bg-white rounded-lg shadow mb-6">
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <p className="text-center text-gray-600">Carregando dados de documentos...</p>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Documentos</h1>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="text-lg font-semibold">Filtros</h2>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contribuinte</label>
                <div className="relative">
                  <input
                    type="text"
                    value={filtroContribuinte}
                    onChange={(e) => setFiltroContribuinte(e.target.value)}
                    placeholder="Nome do contribuinte"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 pl-10"
                  />
                  <FaSearch className="absolute left-3 top-3 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                <select
                  value={filtroTipoDocumento}
                  onChange={(e) => setFiltroTipoDocumento(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                >
                  <option value="">Todos</option>
                  <option value="NF">Nota Fiscal</option>
                  <option value="CUPOM_FISCAL">Cupom Fiscal</option>
                  <option value="RECIBO">Recibo</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="FATURA">Fatura</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ</label>
                <input
                  type="text"
                  value={filtroCpfCnpj}
                  onChange={(e) => setFiltroCpfCnpj(e.target.value)}
                  placeholder="CPF ou CNPJ"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                >
                  <option value="">Todos</option>
                  <option value="VALIDADO">Validados</option>
                  <option value="AGUARDANDO VALIDAÇÃO">Aguardando Validação</option>
                  <option value="INVÁLIDO">Inválidos</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={limparFiltros}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <FaFilter className="inline-block mr-2" />
                Limpar Filtros
              </button>
            </div>
          </div>
          
          <div className="p-4">
            <div className="text-sm text-gray-500 mb-4">
              Documentos filtrados: {documentosFiltrados.length} de {totalDocumentos}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4 flex flex-col justify-between">
                <div className="text-green-700 text-sm font-medium">Cupons Validados</div>
                <div className="text-3xl font-bold text-green-900">{totalValidados}</div>
              </div>
              
              <div className="bg-yellow-50 rounded-lg p-4 flex flex-col justify-between">
                <div className="text-yellow-700 text-sm font-medium">Aguardando Validação</div>
                <div className="text-3xl font-bold text-yellow-900">{totalAguardandoValidacao}</div>
              </div>
              
              <div className="bg-red-50 rounded-lg p-4 flex flex-col justify-between">
                <div className="text-red-700 text-sm font-medium">Invalidados</div>
                <div className="text-3xl font-bold text-red-900">{totalInvalidados}</div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contribuinte
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documento
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documentosFiltrados.length > 0 ? (
                    documentosFiltrados.map((documento) => (
                      <tr key={documento.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {documento.contribuinte || documento.usuarios?.nome_completo || "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {documento.cpf_cnpj || documento.usuarios?.cpf_cnpj || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {getTipoDocumentoLabel(documento.tipo || '')}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-xs" title={documento.descricao || ''}>
                            {documento.chave_acesso || documento.identificador || documento.descricao || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatarDataSemTimezone(documento.data_emissao || documento.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatarMoeda(documento.valor || '0')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {renderStatusBadge(documento.status || '')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => visualizarDocumento(documento.id, documento)}
                              disabled={operacaoEmAndamento}
                              className="text-blue-600 hover:text-blue-900"
                              title="Visualizar documento"
                            >
                              <FaEye className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => validarDocumento(documento.id)}
                              disabled={documento.status === 'VALIDADO' || operacaoEmAndamento}
                              className={`text-green-600 hover:text-green-900 ${documento.status === 'VALIDADO' ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Validar documento"
                            >
                              <FaCheck className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => invalidarDocumento(documento.id)}
                              disabled={documento.status === 'INVÁLIDO' || operacaoEmAndamento}
                              className={`text-red-600 hover:text-red-900 ${documento.status === 'INVÁLIDO' ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Invalidar documento"
                            >
                              <FaTimes className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => aguardarValidacao(documento.id)}
                              disabled={documento.status === 'AGUARDANDO VALIDAÇÃO' || operacaoEmAndamento}
                              className={`text-yellow-600 hover:text-yellow-900 ${documento.status === 'AGUARDANDO VALIDAÇÃO' ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Marcar como aguardando validação"
                            >
                              <FaClock className="w-4 h-4" />
                            </button>
                            
                            {documento.url_documento && (
                              <a
                                href={documento.url_documento}
                                download
                                className="text-gray-600 hover:text-gray-900"
                                title="Baixar documento"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FaDownload className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        <FaExclamationCircle className="inline-block mr-2" />
                        Nenhum documento encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
} 