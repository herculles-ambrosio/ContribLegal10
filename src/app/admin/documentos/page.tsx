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
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Variáveis de ambiente do Supabase não configuradas');
    return supabase;
  }
  
  if (!supabaseServiceKey) {
    console.error('ERRO CRÍTICO: NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY não está configurada');
    return supabase;
  }
  
  try {
    const authKey = supabaseServiceKey;
    
    const clienteAdmin = createClient(supabaseUrl, authKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'apikey': authKey,
          'Authorization': `Bearer ${authKey}`,
          'x-client-info': 'admin-dashboard'
        }
      }
    });
    
    if (!clienteAdmin) {
      return supabase;
    }
    
    return clienteAdmin;
  } catch (error) {
    console.error('Erro ao criar cliente admin:', error);
    return supabase;
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
      
      // Para operações SELECT, queremos os resultados
      try {
        // Usando chamada RPC para executar select
        const { data, error } = await adminClient.rpc('executar_query_select_admin', {
          query_sql: query
        });
        
        if (error) {
          console.error('Erro ao executar query SELECT via RPC:', error);
          return null;
        }
        
        return data;
      } catch (selectError) {
        console.error('Exceção ao executar query SELECT via RPC:', selectError);
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
      
      // Usar SQL direto para carregar documentos com informações de usuário
      const querySelect = `
        SELECT d.*, 
               u.nome_completo, u.email, u.cpf_cnpj as usuario_cpf_cnpj
        FROM documentos d
        LEFT JOIN usuarios u ON d.usuario_id = u.id
        ORDER BY d.created_at DESC
      `;
      
      const documentosData = await executarQueryDireta(adminClient, querySelect);
        
      if (documentosData && documentosData.length > 0) {
        // Transformar os dados para compatibilidade com o tipo DocumentoComUsuario
        const docsFormatados = documentosData.map((doc: any) => ({
          ...doc,
          usuarios: {
            nome_completo: doc.nome_completo,
            email: doc.email,
            cpf_cnpj: doc.usuario_cpf_cnpj
          }
        }));
        
        setDocumentos(docsFormatados);
        setDocumentosFiltrados(docsFormatados);
        setTotalDocumentos(docsFormatados.length);
        
        // Calcular total por status
        const validados = docsFormatados.filter((d: DocumentoComUsuario) => d.status === 'VALIDADO');
        const aguardando = docsFormatados.filter((d: DocumentoComUsuario) => d.status === 'AGUARDANDO VALIDAÇÃO');
        const invalidados = docsFormatados.filter((d: DocumentoComUsuario) => d.status === 'INVÁLIDO');
        
        setTotalValidados(validados.length);
        setTotalAguardandoValidacao(aguardando.length);
        setTotalInvalidados(invalidados.length);
        
        // Calcular valor total dos documentos
        const valorTotal = docsFormatados.reduce((acc: number, doc: DocumentoComUsuario) => {
          const valor = parseFloat(doc.valor?.toString() || '0');
          return acc + (isNaN(valor) ? 0 : valor);
        }, 0);
        setValorTotalDocumentos(valorTotal);
        
        toast.success(`${docsFormatados.length} documentos carregados com sucesso`);
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
  
  // Função para buscar faixas de número da sorte de forma mais precisa
  const buscarFaixaNumeroSorte = async (adminClient: any, valor: number) => {
    try {
      console.log(`Buscando faixa para valor: ${valor}`);
      
      // Consulta SQL direta para encontrar a faixa correta
      const consulta = `
        SELECT * FROM faixas_numero_sorte 
        WHERE ${valor} >= valor_de AND ${valor} <= valor_ate 
        ORDER BY valor_de ASC
      `;
      
      console.log("Consulta de faixas:", consulta);
      const resultado = await executarQueryDireta(adminClient, consulta);
      
      if (resultado && resultado.length > 0) {
        console.log(`Faixa encontrada:`, resultado[0]);
        return resultado[0];
      }
      
      // Se não encontrou, buscar a primeira faixa como fallback
      const consultaDefault = `
        SELECT * FROM faixas_numero_sorte ORDER BY valor_de ASC LIMIT 1
      `;
      const resultadoDefault = await executarQueryDireta(adminClient, consultaDefault);
      
      if (resultadoDefault && resultadoDefault.length > 0) {
        console.log(`Usando faixa padrão:`, resultadoDefault[0]);
        return resultadoDefault[0];
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao buscar faixa:', error);
      return null;
    }
  };
  
  // Atualizar status de documento
  const atualizarStatusDocumento = async (id: string, status: 'VALIDADO' | 'INVÁLIDO' | 'AGUARDANDO VALIDAÇÃO') => {
    try {
      setOperacaoEmAndamento(true);
      console.log(`Atualizando status do documento ${id} para: ${status}`);
      
      // Obter o status atual para atualização de contadores
      const documentoAtual = documentos.find(d => d.id === id);
      const statusAnterior = documentoAtual?.status;
      console.log(`Status anterior: ${statusAnterior}`);
      
      // Criar cliente admin para ignorar RLS
      const adminClient = await criarClienteAdmin();
      
      // Se estiver INVALIDANDO um documento que estava VALIDADO, 
      // precisamos primeiro excluir os números da sorte
      if (status === 'INVÁLIDO' && statusAnterior === 'VALIDADO') {
        console.log(`Excluindo números da sorte do documento ${id}`);
        
        const queryDeleteNumeros = `
          DELETE FROM numeros_sorte_documento 
          WHERE documento_id = '${id}'
        `;
        
        const resultado = await executarQueryDireta(adminClient, queryDeleteNumeros);
        
        if (!resultado) {
          console.log('Aviso: Possível falha ao excluir números da sorte, continuando mesmo assim');
          // Continuamos mesmo se falhar (pode não ter números para excluir)
        } else {
          console.log(`Números da sorte excluídos para o documento ${id}`);
        }
      }
      
      // Utilizar SQL direto para atualizar o status
      const queryUpdate = `
        UPDATE documentos 
        SET status = '${status}', 
            data_validacao = ${status === 'VALIDADO' ? 'NOW()' : 'NULL'}
        WHERE id = '${id}'
      `;
      
      console.log("Executando query de atualização:", queryUpdate);
      
      const resultado = await executarQueryDireta(adminClient, queryUpdate);
      
      if (!resultado) {
        console.error('Erro ao atualizar status do documento');
        toast.error('Erro ao atualizar status do documento');
        setOperacaoEmAndamento(false);
        return;
      }
      
      console.log(`Status do documento atualizado para: ${status}`);
      
      // Se o status for alterado para VALIDADO, gerar números da sorte
      if (status === 'VALIDADO' && statusAnterior !== 'VALIDADO') {
        console.log(`Gerando números da sorte para o documento ${id}`);
        await gerarNumerosDaSorte(adminClient, documentoAtual);
      }
      
      // Atualizar a lista local
      setDocumentos(prevState => 
        prevState.map(doc => {
          if (doc.id === id) {
            return { 
              ...doc, 
              status,
              data_validacao: status === 'VALIDADO' ? new Date().toISOString() : null
            };
          }
          return doc;
        })
      );
      
      // Atualizar contadores
      if (statusAnterior) {
        if (statusAnterior === 'VALIDADO') {
          setTotalValidados(prev => prev - 1);
        } else if (statusAnterior === 'AGUARDANDO VALIDAÇÃO') {
          setTotalAguardandoValidacao(prev => prev - 1);
        } else if (statusAnterior === 'INVÁLIDO') {
          setTotalInvalidados(prev => prev - 1);
        }
      }
      
      if (status === 'VALIDADO') {
        setTotalValidados(prev => prev + 1);
      } else if (status === 'AGUARDANDO VALIDAÇÃO') {
        setTotalAguardandoValidacao(prev => prev + 1);
      } else if (status === 'INVÁLIDO') {
        setTotalInvalidados(prev => prev + 1);
      }
      
      toast.success(`Status do documento atualizado para ${status}`);
      
      // Recarregar os documentos após a atualização
      await carregarDocumentos();
    } catch (error) {
      console.error('Erro ao atualizar status do documento:', error);
      toast.error('Erro ao atualizar status do documento');
    } finally {
      setOperacaoEmAndamento(false);
    }
  };
  
  // Função para gerar números da sorte para documento validado
  const gerarNumerosDaSorte = async (adminClient: any, documento: DocumentoComUsuario | undefined) => {
    if (!documento || !documento.valor) {
      console.error('Documento inválido ou sem valor para gerar números da sorte');
      return;
    }
    
    try {
      const valorDocumento = parseFloat(documento.valor.toString());
      console.log(`Gerando números da sorte para documento com valor: R$ ${valorDocumento}`);
      
      // Buscar a faixa correta para o valor do documento
      const faixa = await buscarFaixaNumeroSorte(adminClient, valorDocumento);
      
      if (!faixa) {
        console.error('Nenhuma faixa de valor encontrada para a geração de números da sorte');
        toast.error('Erro ao determinar a quantidade de números da sorte');
        return;
      }
      
      const qtdNumeros = faixa.quantidade_numeros || 1;
      console.log(`Quantidade de números a gerar: ${qtdNumeros}`);
      
      // 3. Gerar e inserir os números da sorte usando SQL direto
      console.log(`Gerando ${qtdNumeros} números para o documento ${documento.id}`);
      
      // Para cada número a ser gerado, criamos uma entrada na tabela
      for (let i = 0; i < qtdNumeros; i++) {
        // Gerar número aleatório (9 dígitos)
        const numeroSorte = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
        
        const sqlInsercao = `
          INSERT INTO numeros_sorte_documento (documento_id, numero_sorte)
          VALUES ('${documento.id}', '${numeroSorte}')
        `;
        
        console.log(`Inserindo número da sorte ${i+1}/${qtdNumeros}: ${numeroSorte}`);
        const resultadoInsercao = await executarQueryDireta(adminClient, sqlInsercao);
        
        if (!resultadoInsercao) {
          console.error(`Erro ao inserir o número da sorte ${numeroSorte}`);
        }
      }
      
      console.log(`${qtdNumeros} números da sorte gerados para o documento ${documento.id}`);
      toast.success(`${qtdNumeros} números da sorte gerados para este documento`);
    } catch (error) {
      console.error('Erro ao gerar números da sorte:', error);
      toast.error('Erro ao gerar números da sorte');
    }
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
  
  // Visualizar documento
  const visualizarDocumento = async (id: string, documento: DocumentoComUsuario) => {
    try {
      // Determinar qual URL usar com base no tipo de documento
      let urlParaAbrir = '';
      
      // Usar string em vez de enum para compatibilidade com o tipo
      if (documento.tipo && documento.tipo.includes('CUPOM') && documento.numero_documento) {
        // Para cupom fiscal, usar o número do documento como link
        urlParaAbrir = documento.numero_documento;
        
        // Verificar se o número do documento já é uma URL válida
        if (!urlParaAbrir.startsWith('http://') && !urlParaAbrir.startsWith('https://')) {
          urlParaAbrir = `https://${urlParaAbrir}`;
        }
      } else if (documento.url_documento) {
        // Para outros tipos, usar a URL do documento
        urlParaAbrir = documento.url_documento;
      } else if (documento.arquivo_url) {
        // Alternativa se houver arquivo_url
        urlParaAbrir = documento.arquivo_url;
      } else {
        toast.error('Nenhuma URL ou arquivo disponível para este documento');
        return;
      }
      
      console.log(`Abrindo documento: ${urlParaAbrir}`);
      window.open(urlParaAbrir, '_blank');
    } catch (error) {
      console.error('Erro ao visualizar documento:', error);
      toast.error('Erro ao abrir documento');
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
                            {documento.data_emissao 
                              ? new Date(documento.data_emissao).toLocaleDateString('pt-BR')
                              : new Date(documento.created_at).toLocaleDateString('pt-BR')}
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