'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Usuario, Documento } from '@/types/supabase';
import { FaCheck, FaTimes, FaClock, FaUsersCog, FaFileAlt, FaEdit, FaSave, FaUndo, FaSearch, FaFilter } from 'react-icons/fa';
import Layout from '@/components/Layout';
import { getUsuarioLogado } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';

// Função para criar cliente do Supabase com opções específicas para admin
const criarClienteAdmin = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Essa variável deve ser definida somente no ambiente do servidor (não no browser)
  // e só para uso administrativo, nunca expor no frontend
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Variáveis de ambiente do Supabase não configuradas');
    return supabase;
  }
  
  if (!supabaseServiceKey) {
    console.error('ERRO CRÍTICO: NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY não está configurada');
    console.error('Esta chave é necessária para que o admin veja todos os usuários');
    console.error('Adicione-a ao arquivo .env.local na raiz do projeto');
    console.error('ATENÇÃO: Em produção, use essa chave apenas no lado do servidor!');
    return supabase;
  }
  
  // Tentar criar um cliente com opções que ignorem RLS para admins
  try {
    // Usar service_role key para bypass total do RLS
    const authKey = supabaseServiceKey;
    
    console.log('Criando cliente admin com a chave de serviço...');
    
    // Configurações especiais para garantir que o cliente ignore o RLS
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
    
    // Verificar se o cliente foi criado corretamente
    if (!clienteAdmin) {
      console.error('Falha ao criar cliente admin, usando cliente padrão');
      return supabase;
    }
    
    console.log('Cliente admin criado com sucesso!');
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
  }
};

/**
 * Painel Administrativo - Visualização e gerenciamento de todos os documentos e usuários
 * 
 * Importante: Este componente deve exibir TODOS os documentos de TODOS os usuários,
 * independentemente do usuário logado. Implementa várias estratégias para garantir
 * isso, contornando possíveis limitações de RLS.
 */
export default function AdminDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState<Usuario[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoComUsuario[]>([]);
  const [documentosFiltrados, setDocumentosFiltrados] = useState<DocumentoComUsuario[]>([]);
  const [activeTab, setActiveTab] = useState<'documentos' | 'usuarios'>('documentos');
  const [editingUsuarioId, setEditingUsuarioId] = useState<string | null>(null);
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState('');
  const [totalDocumentos, setTotalDocumentos] = useState(0);
  const [valorTotalDocumentos, setValorTotalDocumentos] = useState(0);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [totalValidados, setTotalValidados] = useState(0);
  const [totalAguardandoValidacao, setTotalAguardandoValidacao] = useState(0);
  const [totalInvalidados, setTotalInvalidados] = useState(0);
  const [operacaoEmAndamento, setOperacaoEmAndamento] = useState(false);
  // Filtros para aba Documentos
  const [filtroContribuinte, setFiltroContribuinte] = useState<string>('');
  const [filtroTipoDocumento, setFiltroTipoDocumento] = useState<string>('');
  const [filtroCpfCnpj, setFiltroCpfCnpj] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  // Filtros para aba Usuários
  const [filtroUsuarioNome, setFiltroUsuarioNome] = useState<string>('');
  const [filtroUsuarioCpfCnpj, setFiltroUsuarioCpfCnpj] = useState<string>('');
  
  useEffect(() => {
    const verificarUsuarioMaster = async () => {
      try {
        // Verificar variáveis de ambiente críticas
        verificarVariaveisAmbiente();
        
        // Obter informações do usuário logado
        const usuario = await getUsuarioLogado();
        console.log('Verificando permissões de administrador...');
        
        if (!usuario) {
          console.log('Usuário não autenticado, redirecionando para login');
          router.push('/login');
          return;
        }
        
        // Verificação específica do campo master
        if (usuario.master !== 'S') {
          console.log('Usuário não tem permissão de administrador (master ≠ S)');
          router.push('/dashboard');
          return;
        }
        
        // Guardar o nome do usuário logado
        setNomeUsuarioLogado(usuario.nome_completo || '');
        
        console.log(`Usuário autenticado com permissão de administrador: ${usuario.nome_completo} (ID: ${usuario.id})`);
        console.log('Carregando painel administrativo com TODOS os documentos e usuários...');
        
        // Carregar dados com ID do usuário logado (admin)
        await carregarDados(usuario.id);
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        router.push('/dashboard');
      }
    };
    
    verificarUsuarioMaster();
  }, [router]);
  
  // Função para verificar se as variáveis de ambiente estão configuradas corretamente
  const verificarVariaveisAmbiente = () => {
    console.log('Verificando variáveis de ambiente críticas para painel admin...');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    
    const erros = [];
    
    if (!supabaseUrl) {
      const erro = 'ERRO CRÍTICO: NEXT_PUBLIC_SUPABASE_URL não está definida';
      console.error(erro);
      erros.push(erro);
    }
    
    if (!supabaseAnonKey) {
      const erro = 'ERRO CRÍTICO: NEXT_PUBLIC_SUPABASE_ANON_KEY não está definida';
      console.error(erro);
      erros.push(erro);
    }
    
    if (!supabaseServiceKey) {
      const erro = 'ERRO CRÍTICO: NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY não está definida';
      console.error(erro);
      console.error('Esta variável é necessária para que o admin veja todos os usuários');
      console.error('Adicione-a ao arquivo .env.local na raiz do projeto com a seguinte linha:');
      console.error('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role');
      console.error('A chave pode ser obtida no projeto Supabase em: Configurações > API > service_role key');
      erros.push(erro);
    } else {
      // Não logar a chave completa, apenas verificar se parece válida
      const parece_jwt = supabaseServiceKey.startsWith('eyJ');
      if (!parece_jwt) {
        const erro = 'ALERTA: NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY não parece ser um token JWT válido';
        console.error(erro);
        console.error('Verifique se o valor foi copiado corretamente do Supabase.');
        erros.push(erro);
      } else {
        console.log('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY está presente e parece válida');
      }
    }
    
    if (erros.length > 0) {
      console.error(`Foram encontrados ${erros.length} problemas com as variáveis de ambiente.`);
      console.error('Por favor, corrija-os para que o painel administrativo funcione corretamente.');
      console.error('Após corrigir, reinicie o servidor de desenvolvimento com npm run dev.');
      return false;
    }
    
    console.log('Todas as variáveis de ambiente críticas estão configuradas corretamente.');
    return true;
  };
  
  // Função auxiliar para usar queries SQL diretamente se permitido
  const executarQueryDireta = async (adminClient: any, query: string) => {
    try {
      console.log('Tentando executar query direta:', query);
      
      // Verificar se é uma operação de UPDATE, INSERT ou DELETE
      const isUpdate = query.trim().toLowerCase().startsWith('update') || 
                       query.trim().toLowerCase().startsWith('insert') || 
                       query.trim().toLowerCase().startsWith('delete');
      
      // Para operações de atualização, queremos saber apenas se foi bem-sucedida
      if (isUpdate) {
        try {
          console.log('Detectado comando de atualização (UPDATE/INSERT/DELETE)');
          // Usando chamada RPC para executar update
          const { error } = await adminClient.rpc('executar_query_admin', {
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
          
          // Tentar via REST direto
          try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
            
            if (!serviceKey) {
              console.error('Service key não disponível para operação UPDATE direta');
              return false;
            }
            
            // Fazer requisição REST direta para executar query via RPC
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/executar_query_admin`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`
              },
              body: JSON.stringify({
                'query_sql': query
              })
            });
            
            if (!response.ok) {
              console.error('Erro na resposta REST:', await response.text());
              return false;
            }
            
            return true;
          } catch (restError) {
            console.error('Erro ao executar update via REST:', restError);
            return false;
          }
        }
      }
      
      // Para queries SELECT e outras operações, continua com a implementação original
      // Primeira tentativa: usar a função RPC específica para admins
      try {
        console.log('Método 1: Tentando executar via RPC admin...');
        
        // Log para mostrar a query que está sendo executada
        console.log('Query para RPC:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
        
        // Tenta executar a função RPC
        const { data: rpcData, error: rpcError } = await adminClient.rpc('executar_query_admin', {
          query_sql: query
        });
        
        if (rpcError) {
          console.error('Erro ao executar query via RPC:', rpcError, {
            code: rpcError.code,
            details: rpcError.details,
            hint: rpcError.hint,
            message: rpcError.message
          });
          
          // Verificar se o erro indica que a função não existe
          if (rpcError.message?.includes('function') && rpcError.message?.includes('does not exist')) {
            console.error('ERRO: A função executar_query_admin não existe no banco de dados.');
            console.error('Você precisa executar o script SQL src/db/fix-admin-functions.sql no SQL Editor do Supabase.');
            console.error('1. Acesse o dashboard do Supabase');
            console.error('2. Vá para SQL Editor');
            console.error('3. Cole o conteúdo do arquivo src/db/fix-admin-functions.sql');
            console.error('4. Execute o script com as permissões de superusuário');
          }
        } else if (rpcData) {
          console.log('Query executada com sucesso via RPC:', rpcData?.length || 0, 'registros');
          return rpcData;
        } else {
          console.warn('RPC executou sem erro mas retornou dados vazios ou null');
        }
      } catch (rpcExecError) {
        console.error('Exceção ao executar query via RPC:', rpcExecError);
      }
      
      // Segunda tentativa: tentar executar via REST
      try {
        console.log('Método 2: Tentando executar via REST...');
        
        // Obter a URL base do Supabase e a chave de serviço
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
        
        if (!serviceKey) {
          console.error('ERRO CRÍTICO: Service key não disponível. Verifique se NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY está definida em .env.local');
          throw new Error('Service key não configurada');
        }
        
        console.log('Preparando chamada REST com service key', {
          supabaseUrl: supabaseUrl ? 'definido' : 'indefinido',
          serviceKey: serviceKey ? 'disponível' : 'indisponível',
          urlEndpoint: `${supabaseUrl}/rest/v1/rpc/executar_query_admin`
        });
        
        // Preparar os headers com a chave de autenticação
        const headers = {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'x-client-info': 'admin-dashboard'
        };
        
        // Exibir headers para debug (removendo valores sensíveis)
        console.log('Headers da requisição:', {
          ...headers,
          'apikey': 'PRESENTE',
          'Authorization': 'PRESENTE'
        });
        
        // Construir o corpo da requisição
        const body = JSON.stringify({
          'query_sql': query
        });
        
        // Fazer a requisição REST direta
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/executar_query_admin`, {
          method: 'POST',
          headers,
          body
        });
        
        // Verificar se a resposta foi bem-sucedida
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Erro na resposta REST:', errorText, {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries([...response.headers.entries()])
          });
          throw new Error(`Erro na resposta REST: "${errorText}"`);
        }
        
        const resultData = await response.json();
        
        console.log('Query executada com sucesso via REST:', resultData?.length || 0, 'registros');
        return resultData;
      } catch (restError) {
        console.error('Erro ao executar query via REST:', restError);
      }
      
      // Terceira tentativa: última opção, tentar uma consulta mais tradicional
      console.log('Todas as tentativas de SQL direto falharam. Tentando alternativa...');
      
      // Verificar se é uma consulta SELECT
      if (query.trim().toLowerCase().startsWith('select')) {
        const tabela = extrairTabelaDoSQL(query);
        
        if (tabela) {
          console.log(`Tentando buscar dados da tabela ${tabela} diretamente...`);
          const { data, error } = await adminClient
            .from(tabela)
            .select('*');
            
          if (error) {
            console.error(`Erro ao consultar tabela ${tabela}:`, error);
            return null;
          }
          
          console.log(`Consulta direta da tabela ${tabela} teve sucesso: ${data?.length || 0} registros`);
          return data;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Erro geral ao executar query direta:', error);
      return null;
    }
  };
  
  // Função auxiliar para extrair nome da tabela de uma query SQL
  const extrairTabelaDoSQL = (query: string): string | null => {
    // Expressão regular simplificada para extrair a tabela após FROM em uma query SELECT
    const regex = /\bFROM\s+([a-zA-Z0-9_]+)/i;
    const matches = query.match(regex);
    
    if (matches && matches[1]) {
      return matches[1];
    }
    
    return null;
  };
  
  const carregarDados = async (usuarioId: string) => {
    try {
      console.log(`Iniciando carregamento de dados administrativos - ID do admin: ${usuarioId}`);
      
      // Cliente específico para administradores
      const adminClient = await criarClienteAdmin();
      
      console.log('Carregando TODOS os documentos para o administrador...');
      
      // Carregar documentos via SELECT direto, sem restrição por usuário
      // Inicializar documentos como array vazio para evitar problemas com null
      let documentos: any[] = [];
      
      // A primeira tentativa é usar um SELECT sem filtros para administradores
      // Se houver RLS, essa consulta será filtrada automaticamente
      const { data: docsData, error: documentosError } = await adminClient
        .from('documentos')
        .select(`
          *,
          usuarios(nome_completo, email, cpf_cnpj)
        `)
        .order('created_at', { ascending: false });
      
      // Se temos dados, usamos eles
      if (docsData && docsData.length > 0) {
        documentos = docsData;
        console.log(`Carregados ${documentos.length} documentos via método padrão`);
      } 
      // Se não temos dados ou temos erro, tentamos outras abordagens
      else if (documentosError || !docsData || docsData.length === 0) {
        console.warn('Problema ao carregar documentos via método padrão, tentando alternativa...');
        
        // Tentativa alternativa: consultar todos os IDs de documentos
        // e depois buscar cada documento individualmente (pode ser mais lento)
        const { data: todosIds, error: idsError } = await adminClient
          .from('documentos')
          .select('id');
          
        if (!idsError && todosIds && todosIds.length > 0) {
          console.log(`Encontrados ${todosIds.length} IDs de documentos`);
          
          // Buscar detalhes para cada documento
          const promessasDocumentos = todosIds.map(async (item) => {
            const { data: doc } = await adminClient
              .from('documentos')
              .select(`
                *,
                usuarios(nome_completo, email, cpf_cnpj)
              `)
              .eq('id', item.id)
              .single();
              
            return doc;
          });
          
          const resultados = await Promise.all(promessasDocumentos);
          documentos = resultados.filter(Boolean) as any[];
          console.log(`Carregados ${documentos.length} documentos via método alternativo`);
        }
      }
      
      // Verificar quantidade de documentos carregados
      if (documentos.length === 0) {
        console.warn('Nenhum documento carregado via métodos anteriores. Tentando RPC ou SQL direto...');
        
        // Tentar usar função RPC específica
        try {
          const { data, error } = await adminClient.rpc('admin_listar_todos_documentos');
          if (!error && data && data.length > 0) {
            // Tenta complementar com informações de usuário
            const docsComUsuarios = await Promise.all(data.map(async (doc: any) => {
              const { data: usuarioData } = await adminClient
                .from('usuarios')
                .select('nome_completo, email, cpf_cnpj')
                .eq('id', doc.usuario_id)
                .single();
              
              return {
                ...doc,
                usuarios: usuarioData
              };
            }));
            
            documentos = docsComUsuarios;
            console.log(`Recuperados ${data.length} documentos via função RPC`);
          } else if (error) {
            console.error('Erro na chamada RPC:', error);
          }
        } catch (rpcError) {
          console.error('Exceção na chamada RPC:', rpcError);
        }
        
        // Se ainda não temos documentos, tenta via SQL direto
        if (documentos.length === 0) {
          try {
            // Tenta executar SQL direto (use com cuidado, apenas em ambiente admin controlado)
            const sqlDocs = await executarQueryDireta(
              adminClient, 
              `SELECT d.*, u.nome_completo, u.email, u.cpf_cnpj 
               FROM documentos d 
               JOIN usuarios u ON d.usuario_id = u.id 
               ORDER BY d.created_at DESC`
            );
            
            if (sqlDocs && sqlDocs.length > 0) {
              documentos = sqlDocs.map((doc: any) => ({
                ...doc,
                usuarios: {
                  nome_completo: doc.nome_completo,
                  email: doc.email,
                  cpf_cnpj: doc.cpf_cnpj
                }
              }));
              
              console.log(`Recuperados ${sqlDocs.length} documentos via SQL direto`);
            }
          } catch (sqlError) {
            console.error('Erro na execução SQL direta:', sqlError);
          }
        }
      }
      
      if (documentos.length === 0) {
        console.error('FALHA: Não foi possível carregar nenhum documento mesmo após múltiplas tentativas.');
        console.error('ATENÇÃO: O admin deve ver TODOS os documentos de TODOS os usuários!');
        console.error('Verifique as configurações de RLS no Supabase e adicione uma chave SERVICE_ROLE nas variáveis de ambiente.');
      } else {
        // Log para depuração - verificar se documentos de diferentes usuários estão sendo carregados
        const usuariosIds = [...new Set(documentos.map(d => d.usuario_id))];
        console.log(`Documentos carregados de ${usuariosIds.length} usuários diferentes: ${usuariosIds.join(', ')}`);
        
        if (usuariosIds.length === 1 && usuariosIds[0] === usuarioId) {
          console.warn('ALERTA: Apenas documentos do usuário logado foram carregados!');
          console.warn('ISSO É UM PROBLEMA! O admin deve ver TODOS os documentos de TODOS os usuários.');
          console.warn('Verifique as configurações de RLS no Supabase ou ajuste as permissões.');
        } else {
          console.log('SUCESSO: Documentos de múltiplos usuários foram carregados corretamente.');
        }
      }
      
      // Definir documentos no estado
      setDocumentos(documentos as DocumentoComUsuario[]);
      
      // Calcular totais para o dashboard
      setTotalDocumentos(documentos.length);
      setValorTotalDocumentos(
        documentos.reduce((total, doc) => total + (doc.valor || 0), 0)
      );
      setTotalValidados(
        documentos.filter(doc => doc.status === 'VALIDADO').length
      );
      setTotalAguardandoValidacao(
        documentos.filter(doc => doc.status === 'AGUARDANDO VALIDAÇÃO').length
      );
      setTotalInvalidados(
        documentos.filter(doc => doc.status === 'INVÁLIDO').length
      );
      
      // Carregar usuários - garantir que TODOS os usuários sejam listados
      console.log('Iniciando carregamento de TODOS os usuários...');
      let usuarios: Usuario[] = [];
      
      // Primeiro método: usar função RPC específica para administradores
      try {
        console.log('Tentando carregar usuários via função RPC admin...');
        
        // Log detalhado do cliente
        console.log('Cliente admin tem autenticação:', 
          await adminClient.auth.getSession().then(sess => !!sess.data.session?.access_token ? 'sim' : 'não'));
        
        // Tenta executar a função RPC
        const { data: rpcUsuarios, error: rpcUsuariosError } = await adminClient.rpc('admin_listar_todos_usuarios');
        
        if (rpcUsuariosError) {
          console.error('Erro ao carregar usuários via RPC:', rpcUsuariosError, {
            code: rpcUsuariosError.code,
            details: rpcUsuariosError.details,
            hint: rpcUsuariosError.hint,
            message: rpcUsuariosError.message
          });
          
          // Verificar se o erro indica que a função não existe
          if (rpcUsuariosError.message?.includes('function') && rpcUsuariosError.message?.includes('does not exist')) {
            console.error('ERRO: A função admin_listar_todos_usuarios não existe no banco de dados.');
            console.error('Você precisa executar o script SQL src/db/fix-admin-functions.sql no SQL Editor do Supabase.');
            console.error('1. Acesse o dashboard do Supabase');
            console.error('2. Vá para SQL Editor');
            console.error('3. Cole o conteúdo do arquivo src/db/fix-admin-functions.sql');
            console.error('4. Execute o script com as permissões de superusuário');
          }
          
        } else if (rpcUsuarios && rpcUsuarios.length > 0) {
          usuarios = rpcUsuarios;
          console.log(`Recuperados ${usuarios.length} usuários via função RPC admin`);
        } else {
          console.warn('Função RPC retornou com sucesso, mas sem dados');
        }
      } catch (rpcError) {
        console.error('Exceção ao carregar usuários via RPC:', rpcError);
      }
      
      // Se não conseguimos via RPC, tentamos SQL direto
      if (usuarios.length === 0) {
        // Tentar consulta direta via SQL para garantir que todos os usuários sejam retornados
        try {
          console.log('Tentando carregar usuários via SQL direto (modo mais confiável)...');
          
          const query = `SELECT * FROM usuarios ORDER BY nome_completo`;
          console.log('Query SQL para usuários:', query);
          
          const sqlUsuarios = await executarQueryDireta(
            adminClient, 
            query
          );
          
          if (sqlUsuarios && sqlUsuarios.length > 0) {
            usuarios = sqlUsuarios;
            console.log(`Recuperados ${sqlUsuarios.length} usuários via SQL direto`);
            
            // Log para debug - verificar tipos de usuários recuperados
            const admins = sqlUsuarios.filter((u: any) => u.master === 'S').length;
            const comuns = sqlUsuarios.filter((u: any) => u.master !== 'S').length;
            console.log(`Tipos de usuários recuperados: ${admins} administradores, ${comuns} usuários comuns`);
            
          } else {
            console.warn('SQL direto não retornou usuários ou retornou null');
          }
        } catch (sqlError) {
          console.error('Erro na execução SQL direta para usuários:', sqlError);
        }
      }
      
      // Se não conseguimos via SQL direto, tentamos o método padrão
      if (usuarios.length === 0) {
        console.log('Tentando carregar usuários via método padrão...');
        const { data: usersDirect, error: usersDirectError } = await adminClient
          .from('usuarios')
          .select('*')
          .order('nome_completo');
        
        if (!usersDirectError && usersDirect && usersDirect.length > 0) {
          usuarios = usersDirect;
          console.log(`Carregados ${usuarios.length} usuários via método padrão`);
        } else if (usersDirectError) {
          console.error('Erro ao carregar usuários via método padrão:', usersDirectError);
          
          // Tentar usar método alternativo com fetch direto
          try {
            console.log('Tentando carregar usuários via fetch direto com apikey...');
            
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
            
            if (!serviceKey) {
              console.error('ERRO CRÍTICO: Service key não disponível para fetch de usuários. Verifique se NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY está definida em .env.local');
              throw new Error('Service key não configurada');
            }
            
            console.log('Preparando fetch direto de usuários', {
              endpoint: `${supabaseUrl}/rest/v1/usuarios?select=*&order=nome_completo`,
              serviceKey: serviceKey ? 'disponível' : 'indisponível'
            });
            
            // Headers completos para autenticação
            const headers = {
              'Content-Type': 'application/json',
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Prefer': 'return=representation'
            };
            
            // Exibir headers para debug (removendo valores sensíveis)
            console.log('Headers do fetch de usuários:', {
              ...headers,
              'apikey': 'PRESENTE',
              'Authorization': 'PRESENTE'
            });
            
            const response = await fetch(`${supabaseUrl}/rest/v1/usuarios?select=*&order=nome_completo`, {
              method: 'GET',
              headers
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('Erro na resposta fetch de usuários:', errorText, {
                status: response.status, 
                statusText: response.statusText,
                headers: Object.fromEntries([...response.headers.entries()])
              });
              throw new Error(`Erro no fetch de usuários: "${errorText}"`);
            }
            
            const fetchedUsers = await response.json();
            if (fetchedUsers && fetchedUsers.length > 0) {
              usuarios = fetchedUsers;
              console.log(`Recuperados ${usuarios.length} usuários via fetch direto`);
            } else {
              console.warn('Fetch direto não retornou usuários');
            }
          } catch (fetchError) {
            console.error('Erro ao realizar fetch direto para usuários:', fetchError);
          }
        }
      }
      
      // Método alternativo como última opção
      if (usuarios.length === 0) {
        try {
          console.log('Tentando carregar usuários via consulta alternativa...');
          
          // Tentar carregar IDs e depois detalhes
          const { data: userIds } = await adminClient
            .from('usuarios')
            .select('id');
            
          if (userIds && userIds.length > 0) {
            const promessasUsuarios = userIds.map(async (item) => {
              const { data: user } = await adminClient
                .from('usuarios')
                .select('*')
                .eq('id', item.id)
                .single();
              
              return user;
            });
            
            const resultados = await Promise.all(promessasUsuarios);
            const usuariosValidos = resultados.filter(Boolean) as Usuario[];
            
            if (usuariosValidos.length > 0) {
              usuarios = usuariosValidos;
              console.log(`Carregados ${usuarios.length} usuários via método alternativo`);
            }
          }
        } catch (altError) {
          console.error('Erro na tentativa alternativa de carregar usuários:', altError);
        }
      }
      
      if (usuarios.length === 0) {
        console.error('FALHA: Não foi possível carregar a lista de usuários mesmo após múltiplas tentativas.');
        console.error('ATENÇÃO: O admin deve ver TODOS os usuários do sistema!');
        console.error('Verifique as configurações de RLS no Supabase e adicione uma chave SERVICE_ROLE nas variáveis de ambiente.');
      } else {
        console.log(`SUCESSO: Carregados ${usuarios.length} usuários para o administrador.`);
        
        // Verificar se há usuários de diferentes tipos (admin/não-admin)
        const temAdmin = usuarios.some(u => u.master === 'S');
        const temUsuarioComum = usuarios.some(u => u.master !== 'S');
        
        if (temAdmin && temUsuarioComum) {
          console.log('Lista de usuários contém tanto administradores quanto usuários comuns.');
        } else {
          console.warn('A lista de usuários não parece completa - pode estar faltando administradores ou usuários comuns.');
          console.warn('Verifique as configurações de RLS no Supabase ou ajuste as permissões.');
        }
      }
      
      setUsuarios(usuarios);
    } catch (error) {
      console.error('Erro ao carregar dados administrativos:', error);
      console.error('Por favor, verifique as permissões e configurações de RLS no Supabase.');
    }
  };
  
  // Atualizar totalizadores quando documentos mudam
  useEffect(() => {
    const total = documentos.length;
    const valorTotal = documentos.reduce((sum, doc) => sum + (Number(doc.valor) || 0), 0);
    
    setTotalDocumentos(total);
    setValorTotalDocumentos(valorTotal);
    setDocumentosFiltrados(documentos);
  }, [documentos]);
  
  // Atualizar totalizadores quando usuários mudam
  useEffect(() => {
    const total = usuarios.length;
    const admins = usuarios.filter(user => user.master === 'S').length;
    
    setTotalUsuarios(total);
    setTotalAdmins(admins);
    setUsuariosFiltrados(usuarios);
  }, [usuarios]);
  
  // Aplicar filtros nos documentos
  useEffect(() => {
    let filtrados = [...documentos];
    
    // Filtro por nome do contribuinte
    if (filtroContribuinte) {
      const termoPesquisa = filtroContribuinte.toLowerCase();
      filtrados = filtrados.filter(doc => 
        doc.usuarios?.nome_completo?.toLowerCase().includes(termoPesquisa)
      );
    }
    
    // Filtro por tipo de documento
    if (filtroTipoDocumento) {
      if (filtroTipoDocumento === 'cupom_fiscal') {
        // Para cupom fiscal, também mostrar documentos do tipo nota_venda (que são iguais)
        filtrados = filtrados.filter(doc => doc.tipo === 'cupom_fiscal' || doc.tipo === 'nota_venda');
      } else {
        filtrados = filtrados.filter(doc => doc.tipo === filtroTipoDocumento);
      }
    }
    
    // Filtro por CPF/CNPJ
    if (filtroCpfCnpj) {
      const termoPesquisa = filtroCpfCnpj.toLowerCase().replace(/[^\d]/g, '');
      filtrados = filtrados.filter(doc => 
        doc.usuarios?.cpf_cnpj?.toLowerCase().replace(/[^\d]/g, '').includes(termoPesquisa)
      );
    }
    
    // Filtro por status
    if (filtroStatus) {
      filtrados = filtrados.filter(doc => doc.status === filtroStatus);
    }
    
    setDocumentosFiltrados(filtrados);
  }, [filtroContribuinte, filtroTipoDocumento, filtroCpfCnpj, filtroStatus, documentos]);
  
  // Aplicar filtros nos usuários
  useEffect(() => {
    let filtrados = [...usuarios];
    
    // Filtro por nome do usuário
    if (filtroUsuarioNome) {
      const termoPesquisa = filtroUsuarioNome.toLowerCase();
      filtrados = filtrados.filter(usuario => 
        usuario.nome_completo?.toLowerCase().includes(termoPesquisa)
      );
    }
    
    // Filtro por CPF/CNPJ
    if (filtroUsuarioCpfCnpj) {
      const termoPesquisa = filtroUsuarioCpfCnpj.toLowerCase().replace(/[^\d]/g, '');
      filtrados = filtrados.filter(usuario => 
        usuario.cpf_cnpj?.toLowerCase().replace(/[^\d]/g, '').includes(termoPesquisa)
      );
    }
    
    setUsuariosFiltrados(filtrados);
  }, [filtroUsuarioNome, filtroUsuarioCpfCnpj, usuarios]);
  
  // Calcular valor total dos documentos filtrados
  const calcularValorTotal = () => {
    return documentosFiltrados.reduce((total, doc) => total + doc.valor, 0);
  };

  const getTipoDocumentoLabel = (tipo: string) => {
    switch (tipo) {
      case 'nota_servico':
        return 'NOTA FISCAL DE SERVIÇO';
      case 'cupom_fiscal':
        return 'CUPOM FISCAL';
      case 'nota_venda':
        return 'CUPOM FISCAL';
      case 'imposto':
        return 'COMPROVANTE DE PAGAMENTO DE IMPOSTO';
      default:
        return tipo.replace('_', ' ').toUpperCase();
    }
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltroContribuinte('');
    setFiltroTipoDocumento('');
    setFiltroCpfCnpj('');
    setFiltroStatus('');
  };
  
  const atualizarStatusDocumento = async (id: string, status: 'VALIDADO' | 'INVÁLIDO' | 'AGUARDANDO VALIDAÇÃO') => {
    try {
      setOperacaoEmAndamento(true);
      
      // Usa o cliente admin para garantir a atualização
      const adminClient = await criarClienteAdmin();
      
      console.log(`Atualizando status do documento ${id} para ${status}...`);
      
      // Tenta atualizar usando método padrão primeiro
      const { error } = await adminClient
        .from('documentos')
        .update({ status })
        .eq('id', id);
      
      if (error) {
        console.error('Erro ao atualizar via método padrão:', error);
        
        // Tentativa alternativa via SQL direto
        try {
          console.log('Tentando atualizar via SQL direto...');
          const resultado = await executarQueryDireta(
            adminClient,
            `UPDATE documentos SET status = '${status}' WHERE id = '${id}'`
          );
          
          if (!resultado) {
            throw new Error('Falha na atualização SQL direta');
          }
          
          console.log('Atualização via SQL direto concluída com sucesso');
        } catch (sqlError) {
          console.error('Erro na execução SQL direta para atualização:', sqlError);
          throw new Error('Não foi possível atualizar o status do documento');
        }
      } else {
        console.log('Status atualizado com sucesso via método padrão');
      }
      
      // Atualizar o estado local
      setDocumentos(prev => 
        prev.map(doc => doc.id === id ? { ...doc, status } : doc)
      );
      
      // Atualizar os contadores do dashboard
      const documentoAntigo = documentos.find(doc => doc.id === id);
      if (documentoAntigo) {
        const statusAntigo = documentoAntigo.status;
        
        // Atualizar contador de documentos validados
        if (status === 'VALIDADO') {
          setTotalValidados(prev => prev + 1);
          if (statusAntigo === 'AGUARDANDO VALIDAÇÃO') {
            setTotalAguardandoValidacao(prev => prev - 1);
          } else if (statusAntigo === 'INVÁLIDO') {
            setTotalInvalidados(prev => prev - 1);
          }
        }
        // Atualizar contador de documentos invalidados
        else if (status === 'INVÁLIDO') {
          setTotalInvalidados(prev => prev + 1);
          if (statusAntigo === 'AGUARDANDO VALIDAÇÃO') {
            setTotalAguardandoValidacao(prev => prev - 1);
          } else if (statusAntigo === 'VALIDADO') {
            setTotalValidados(prev => prev - 1);
          }
        }
        // Atualizar contador de documentos aguardando validação
        else if (status === 'AGUARDANDO VALIDAÇÃO') {
          setTotalAguardandoValidacao(prev => prev + 1);
          if (statusAntigo === 'VALIDADO') {
            setTotalValidados(prev => prev - 1);
          } else if (statusAntigo === 'INVÁLIDO') {
            setTotalInvalidados(prev => prev - 1);
          }
        }
      }
      
      // Exibir alerta de sucesso
      alert(`Status do documento alterado para ${status} com sucesso!`);
    } catch (error) {
      console.error('Erro ao atualizar status do documento:', error);
      alert(`Erro ao atualizar status: ${error}`);
    } finally {
      setOperacaoEmAndamento(false);
    }
  };
  
  const toggleUsuarioMaster = async (id: string, currentValue: 'S' | 'N') => {
    try {
      // Validação adicional para garantir que o valor é válido
      if (currentValue !== 'S' && currentValue !== 'N') {
        console.error(`Valor inválido para permissão de administrador: ${currentValue}`);
        alert('Valor inválido para permissão de administrador. Use "S" ou "N".');
        return;
      }
      
      setOperacaoEmAndamento(true);
      
      // O valor atual já é o novo valor selecionado pelo usuário, não precisamos inverter
      const novoValor = currentValue;
      
      console.log(`Alterando permissão de administrador do usuário ${id} para ${novoValor}...`);
      console.log(`Valor recebido do select: ${currentValue}`);
      
      // Usa o cliente admin para garantir a atualização
      const adminClient = await criarClienteAdmin();
      
      // Log para verificar se a client admin foi criada corretamente
      console.log('Cliente admin criado:', !!adminClient);
      
      if (!adminClient) {
        throw new Error('Não foi possível criar o cliente admin - verifique as variáveis de ambiente');
      }
      
      // Tenta atualizar usando método padrão primeiro
      const { data, error } = await adminClient
        .from('usuarios')
        .update({ master: novoValor })
        .eq('id', id)
        .select();
      
      console.log('Resposta da atualização:', { data, error });
      
      if (error) {
        console.error('Erro ao atualizar via método padrão:', error);
        
        // Tentativa alternativa via SQL direto
        try {
          console.log('Tentando atualizar via SQL direto...');
          const sucesso = await executarQueryDireta(
            adminClient,
            `UPDATE usuarios SET master = '${novoValor}' WHERE id = '${id}'`
          );
          
          if (!sucesso) {
            throw new Error('Falha na atualização SQL direta');
          }
          
          console.log('Atualização via SQL direto concluída com sucesso');
        } catch (sqlError) {
          console.error('Erro na execução SQL direta para atualização:', sqlError);
          throw new Error('Não foi possível atualizar o status de administrador');
        }
      } else {
        console.log('Status de administrador atualizado com sucesso via método padrão');
      }
      
      // Atualizar o estado local
      setUsuarios(prev => 
        prev.map(user => user.id === id ? { ...user, master: novoValor } : user)
      );
      
      setEditingUsuarioId(null);
      
      // Exibir alerta de sucesso
      alert(`Permissão de administrador alterada com sucesso!`);
    } catch (error) {
      console.error('Erro ao atualizar status de administrador:', error);
      alert(`Erro ao atualizar permissão: ${error}`);
    } finally {
      setOperacaoEmAndamento(false);
    }
  };
  
  const visualizarDocumento = async (id: string, url: string) => {
    try {
      console.log(`Tentando visualizar documento ${id} com URL: ${url}`);
      setOperacaoEmAndamento(true);
      
      if (!url || url.trim() === '') {
        console.error(`URL não fornecida para o documento ${id}`);
        toast.error('URL do documento não encontrada');
        setOperacaoEmAndamento(false);
        return;
      }
      
      // Obter cliente Supabase
      const adminClient = await criarClienteAdmin();

      // Gerar URL assinada para o arquivo no storage
      const { data, error } = await adminClient.storage
        .from('documentos')
        .createSignedUrl(url, 60); // URL válida por 60 segundos
      
      if (error) {
        console.error('Erro ao gerar URL assinada:', error);
        toast.error(`Erro ao acessar o documento: ${error.message}`);
        setOperacaoEmAndamento(false);
        return;
      }
      
      if (!data || !data.signedUrl) {
        console.error('URL assinada não gerada');
        toast.error('Não foi possível gerar o link para o documento');
        setOperacaoEmAndamento(false);
        return;
      }
      
      console.log('URL assinada gerada com sucesso:', data.signedUrl);
      
      // Abrir em uma nova aba/janela
      window.open(data.signedUrl, '_blank');
      
      toast.success('Documento aberto em uma nova aba');
    } catch (error: any) {
      console.error('Erro ao visualizar documento:', error);
      toast.error(`Erro ao visualizar documento: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setOperacaoEmAndamento(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <Layout isAuthenticated>
      {operacaoEmAndamento && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
            <span>Processando operação...</span>
          </div>
        </div>
      )}
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Painel Administrativo</h1>
        <p className="text-gray-600">
          Bem-vindo(a) ao painel administrativo, {nomeUsuarioLogado}
        </p>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden mb-8">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('documentos')}
            className={`flex items-center py-4 px-6 ${activeTab === 'documentos' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
          >
            <FaFileAlt className="mr-2" />
            Documentos
          </button>
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`flex items-center py-4 px-6 ${activeTab === 'usuarios' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
          >
            <FaUsersCog className="mr-2" />
            Usuários
          </button>
        </div>
        
        {activeTab === 'documentos' && (
          <div className="p-6">
            {/* Filtros */}
            <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="text-lg font-medium mb-3 flex items-center">
                <FaFilter className="mr-2 text-blue-500" />
                Filtros
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="filtroContribuinte" className="block text-sm font-medium text-gray-700 mb-1">
                    Contribuinte
                  </label>
                  <input
                    type="text"
                    id="filtroContribuinte"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nome do contribuinte"
                    value={filtroContribuinte}
                    onChange={(e) => setFiltroContribuinte(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="filtroTipoDocumento" className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Documento
                  </label>
                  <select
                    id="filtroTipoDocumento"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={filtroTipoDocumento}
                    onChange={(e) => setFiltroTipoDocumento(e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="nota_servico">Nota Fiscal de Serviço</option>
                    <option value="cupom_fiscal">Cupom Fiscal</option>
                    <option value="imposto">Comprovante de Pagamento de Imposto</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="filtroCpfCnpj" className="block text-sm font-medium text-gray-700 mb-1">
                    CPF/CNPJ
                  </label>
                  <input
                    type="text"
                    id="filtroCpfCnpj"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="CPF ou CNPJ"
                    value={filtroCpfCnpj}
                    onChange={(e) => setFiltroCpfCnpj(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="filtroStatus" className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    id="filtroStatus"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="VALIDADO">Validado</option>
                    <option value="AGUARDANDO VALIDAÇÃO">Aguardando Validação</option>
                    <option value="INVÁLIDO">Inválido</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={limparFiltros}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
            
            {/* Totalizadores dos documentos filtrados */}
            <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex flex-wrap justify-between items-center">
                <div className="text-blue-800">
                  <span className="font-medium">Documentos filtrados:</span> {documentosFiltrados.length} de {totalDocumentos}
                </div>
                <div className="text-blue-800">
                  <span className="font-medium">Valor total:</span> {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(calcularValorTotal())}
                </div>
              </div>
            </div>
            
            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium text-green-800">Cupons Validados</h3>
                <p className="text-3xl font-bold text-green-600">{totalValidados}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium text-yellow-800">Aguardando Validação</h3>
                <p className="text-3xl font-bold text-yellow-600">{totalAguardandoValidacao}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium text-red-800">Invalidados</h3>
                <p className="text-3xl font-bold text-red-600">{totalInvalidados}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium text-blue-800">Valor Total</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(valorTotalDocumentos)}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="py-3 px-4 text-left">Contribuinte</th>
                    <th className="py-3 px-4 text-left">Documento</th>
                    <th className="py-3 px-4 text-left">Data</th>
                    <th className="py-3 px-4 text-left">Valor</th>
                    <th className="py-3 px-4 text-left">Nº da Sorte</th>
                    <th className="py-3 px-4 text-left">Status</th>
                    <th className="py-3 px-4 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {documentosFiltrados.map(doc => {
                    const usuario = doc.usuarios;
                    return (
                      <tr key={doc.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>{usuario?.nome_completo}</div>
                          <div className="text-sm text-gray-500">{usuario?.cpf_cnpj}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{getTipoDocumentoLabel(doc.tipo)}</div>
                          <div className="text-sm text-gray-500">#{doc.numero_documento}</div>
                        </td>
                        <td className="py-3 px-4">
                          {new Date(doc.data_emissao).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(doc.valor)}
                        </td>
                        <td className="py-3 px-4">
                          {doc.numero_sorteio}
                        </td>
                        <td className="py-3 px-4">
                          <span 
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${doc.status === 'VALIDADO' ? 'bg-green-100 text-green-800' : 
                                doc.status === 'INVÁLIDO' ? 'bg-red-100 text-red-800' : 
                                'bg-yellow-100 text-yellow-800'}`}
                          >
                            {doc.status === 'VALIDADO' && <FaCheck className="mr-1" />}
                            {doc.status === 'INVÁLIDO' && <FaTimes className="mr-1" />}
                            {doc.status === 'AGUARDANDO VALIDAÇÃO' && <FaClock className="mr-1" />}
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => atualizarStatusDocumento(doc.id, 'VALIDADO')}
                              className="bg-green-500 hover:bg-green-600 text-white p-1 rounded"
                              title="Validar"
                            >
                              <FaCheck />
                            </button>
                            <button 
                              onClick={() => atualizarStatusDocumento(doc.id, 'INVÁLIDO')}
                              className="bg-red-500 hover:bg-red-600 text-white p-1 rounded"
                              title="Invalidar"
                            >
                              <FaTimes />
                            </button>
                            <button 
                              onClick={() => atualizarStatusDocumento(doc.id, 'AGUARDANDO VALIDAÇÃO')}
                              className="bg-yellow-500 hover:bg-yellow-600 text-white p-1 rounded"
                              title="Aguardando"
                            >
                              <FaClock />
                            </button>
                            <button 
                              onClick={() => visualizarDocumento(doc.id, doc.arquivo_url)}
                              className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded"
                              title="Visualizar arquivo"
                            >
                              <FaFileAlt />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab === 'usuarios' && (
          <div className="p-6">
            {/* Filtros */}
            <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="text-lg font-medium mb-3 flex items-center">
                <FaFilter className="mr-2 text-blue-500" />
                Filtros
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="filtroUsuarioNome" className="block text-sm font-medium text-gray-700 mb-1">
                    Usuário
                  </label>
                  <input
                    type="text"
                    id="filtroUsuarioNome"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nome do usuário"
                    value={filtroUsuarioNome}
                    onChange={(e) => setFiltroUsuarioNome(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="filtroUsuarioCpfCnpj" className="block text-sm font-medium text-gray-700 mb-1">
                    CPF/CNPJ
                  </label>
                  <input
                    type="text"
                    id="filtroUsuarioCpfCnpj"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="CPF ou CNPJ"
                    value={filtroUsuarioCpfCnpj}
                    onChange={(e) => setFiltroUsuarioCpfCnpj(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setFiltroUsuarioNome('');
                    setFiltroUsuarioCpfCnpj('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
            
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-purple-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium text-purple-800">Total de Usuários</h3>
                <p className="text-3xl font-bold text-purple-600">{totalUsuarios}</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium text-indigo-800">Administradores</h3>
                <p className="text-3xl font-bold text-indigo-600">{totalAdmins}</p>
              </div>
            </div>
            
            {usuariosFiltrados.length === 0 && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <h3 className="text-lg font-medium text-red-800 mb-2">Erro ao carregar usuários</h3>
                <p className="mb-3">Não foi possível carregar a lista de usuários devido a problemas de configuração ou permissão.</p>
                
                <h4 className="font-bold mt-2">Como resolver:</h4>
                <ol className="list-decimal ml-5 space-y-2 mt-1">
                  <li>Verifique se a variável <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY</code> está configurada no arquivo <code className="bg-gray-100 px-1 rounded">.env.local</code></li>
                  <li>Execute o script SQL <code className="bg-gray-100 px-1 rounded">src/db/fix-rls-complete.sql</code> no SQL Editor do Supabase:
                    <ul className="list-disc ml-5 mt-1">
                      <li>Acesse o dashboard do Supabase</li>
                      <li>Vá para SQL Editor</li>
                      <li>Cole o conteúdo do arquivo</li>
                      <li>Execute o script</li>
                    </ul>
                  </li>
                  <li>Confirme que as políticas RLS estão configuradas corretamente executando o script de verificação:
                    <pre className="bg-gray-800 text-white p-2 rounded text-sm my-2 overflow-x-auto">
                      node src/scripts/verify-database.js
                    </pre>
                  </li>
                  <li>Reinicie o servidor</li>
                  <li>Se os problemas persistirem, você pode temporariamente desabilitar o RLS para diagnóstico:
                    <pre className="bg-gray-800 text-white p-2 rounded text-sm my-2 overflow-x-auto">
                      ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
                      ALTER TABLE documentos DISABLE ROW LEVEL SECURITY;
                    </pre>
                  </li>
                </ol>
                
                <h4 className="font-bold mt-3">Exemplo de .env.local:</h4>
                <pre className="bg-gray-800 text-white p-3 rounded text-sm my-2 overflow-x-auto">
                  NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co<br />
                  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...<br />
                  NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1...
                </pre>
                
                <div className="mt-4 flex space-x-4">
                  <a 
                    href="https://supabase.com/docs/guides/api/server-side-admin" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Documentação do Supabase sobre chaves de serviço
                  </a>
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Recarregar página
                  </button>
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="py-3 px-4 text-left">Nome</th>
                    <th className="py-3 px-4 text-left">E-mail</th>
                    <th className="py-3 px-4 text-left">CPF/CNPJ</th>
                    <th className="py-3 px-4 text-left">Administrador</th>
                    <th className="py-3 px-4 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map(user => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{user.nome_completo}</td>
                      <td className="py-3 px-4">{user.email}</td>
                      <td className="py-3 px-4">{user.cpf_cnpj}</td>
                      <td className="py-3 px-4">
                        {editingUsuarioId === user.id ? (
                          <select 
                            className="border rounded p-1"
                            value={user.master}
                            onChange={(e) => toggleUsuarioMaster(user.id, e.target.value as 'S' | 'N')}
                          >
                            <option value="S">Sim</option>
                            <option value="N">Não</option>
                          </select>
                        ) : (
                          <span 
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${user.master === 'S' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}
                          >
                            {user.master === 'S' ? 'Sim' : 'Não'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          {editingUsuarioId === user.id ? (
                            <>
                              <button 
                                onClick={() => setEditingUsuarioId(null)}
                                className="bg-gray-500 hover:bg-gray-600 text-white p-1 rounded"
                                title="Cancelar"
                              >
                                <FaUndo />
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => setEditingUsuarioId(user.id)}
                              className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded"
                              title="Editar"
                            >
                              <FaEdit />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
} 