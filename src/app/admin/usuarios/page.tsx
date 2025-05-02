'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaEdit, FaSave, FaUndo, FaSearch, FaUnlock, FaLock, FaTrash } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { Usuario } from '@/types/supabase';
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

/**
 * Gerenciamento de Usuários - Visualização e gerenciamento de todos os usuários
 */
export default function UsuariosAdmin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState<Usuario[]>([]);
  const [editingUsuarioId, setEditingUsuarioId] = useState<string | null>(null);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [operacaoEmAndamento, setOperacaoEmAndamento] = useState(false);
  // Filtros para aba Usuários
  const [filtroUsuarioNome, setFiltroUsuarioNome] = useState<string>('');
  const [filtroUsuarioCpfCnpj, setFiltroUsuarioCpfCnpj] = useState<string>('');
  
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
        await carregarUsuarios();
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
          return false;
        }
      }
      
      // Para operações SELECT, queremos os resultados
      try {
        const { data, error } = await adminClient
          .from('_resultados_query_admin')
          .select('*');
        
        if (error) {
          console.error('Erro ao executar query SELECT via views protegidas:', error);
          return null;
        }
        
        return data;
      } catch (selectError) {
        console.error('Exceção ao executar query SELECT via views protegidas:', selectError);
        return null;
      }
    } catch (error) {
      console.error('Erro geral ao executar query:', error);
      return null;
    }
  };
  
  // Função para carregar dados da tabela usuarios
  const carregarUsuarios = async () => {
    try {
      setIsLoading(true);
      
      // Criar cliente admin para ignorar RLS
      const adminClient = await criarClienteAdmin();
      
      // Tentar carregar usando cliente admin - recomendado
      const { data: usuariosData, error: usuariosError } = await adminClient
        .from('usuarios')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (usuariosError) {
        console.error('Erro ao carregar usuários:', usuariosError);
        toast.error('Erro ao carregar dados de usuários');
      }
      
      // Processar dados recebidos
      if (usuariosData && usuariosData.length > 0) {
        setUsuarios(usuariosData);
        setUsuariosFiltrados(usuariosData);
        setTotalUsuarios(usuariosData.length);
        
        // Contar total de admins
        const admins = usuariosData.filter(u => u.master === 'S');
        setTotalAdmins(admins.length);
        
        toast.success(`${usuariosData.length} usuários carregados com sucesso`);
      } else {
        console.warn('Nenhum usuário encontrado ou retornado');
        toast.error('Nenhum usuário encontrado');
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do painel administrativo');
      setIsLoading(false);
    }
  };
  
  // Filtragem de usuários
  useEffect(() => {
    const filtragemUsuarios = () => {
      if (!usuarios || usuarios.length === 0) return;
      
      let resultado = [...usuarios];
      
      if (filtroUsuarioNome) {
        resultado = resultado.filter(u => 
          u.nome_completo?.toLowerCase().includes(filtroUsuarioNome.toLowerCase())
        );
      }
      
      if (filtroUsuarioCpfCnpj) {
        resultado = resultado.filter(u => 
          u.cpf_cnpj?.includes(filtroUsuarioCpfCnpj)
        );
      }
      
      setUsuariosFiltrados(resultado);
    };
    
    filtragemUsuarios();
  }, [usuarios, filtroUsuarioNome, filtroUsuarioCpfCnpj]);
  
  // Limpar filtros
  const limparFiltros = () => {
    setFiltroUsuarioNome('');
    setFiltroUsuarioCpfCnpj('');
  };
  
  // Alternar status de usuário master (admin)
  const toggleUsuarioMaster = async (id: string, currentValue: 'S' | 'N') => {
    try {
      setOperacaoEmAndamento(true);
      
      const novoValor = currentValue === 'S' ? 'N' : 'S';
      const adminClient = await criarClienteAdmin();
      
      // Atualizar o valor do campo master
      const { error } = await adminClient
        .from('usuarios')
        .update({ master: novoValor })
        .eq('id', id);
        
      if (error) {
        console.error('Erro ao alterar permissão do usuário:', error);
        toast.error('Erro ao alterar permissão do usuário');
        setOperacaoEmAndamento(false);
        return;
      }
      
      // Atualizar a lista local
      setUsuarios(prevState => 
        prevState.map(user => {
          if (user.id === id) {
            return { ...user, master: novoValor };
          }
          return user;
        })
      );
      
      // Atualizar contadores
      if (novoValor === 'S') {
        setTotalAdmins(prev => prev + 1);
      } else {
        setTotalAdmins(prev => prev - 1);
      }
      
      toast.success(`Permissões do usuário alteradas com sucesso`);
    } catch (error) {
      console.error('Erro ao alterar permissão do usuário:', error);
      toast.error('Erro ao alterar permissão do usuário');
    } finally {
      setOperacaoEmAndamento(false);
    }
  };
  
  // Excluir um usuário
  const excluirUsuario = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      setOperacaoEmAndamento(true);
      
      const adminClient = await criarClienteAdmin();
      
      // Excluir o usuário
      const { error } = await adminClient
        .from('usuarios')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Erro ao excluir usuário:', error);
        toast.error('Erro ao excluir usuário');
        setOperacaoEmAndamento(false);
        return;
      }
      
      // Atualizar a lista local
      setUsuarios(prevState => prevState.filter(user => user.id !== id));
      setTotalUsuarios(prev => prev - 1);
      
      toast.success('Usuário excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast.error('Erro ao excluir usuário');
    } finally {
      setOperacaoEmAndamento(false);
    }
  };
  
  // Editar usuário
  const iniciarEdicaoUsuario = (id: string) => {
    setEditingUsuarioId(id);
  };
  
  const cancelarEdicaoUsuario = () => {
    setEditingUsuarioId(null);
  };
  
  const salvarEdicaoUsuario = async (usuario: Usuario) => {
    try {
      setOperacaoEmAndamento(true);
      
      const adminClient = await criarClienteAdmin();
      
      // Extrair apenas os campos editáveis
      const dadosAtualizados = {
        nome_completo: usuario.nome_completo,
        email: usuario.email,
        cpf_cnpj: usuario.cpf_cnpj,
        telefone: usuario.telefone
      };
      
      // Atualizar o usuário
      const { error } = await adminClient
        .from('usuarios')
        .update(dadosAtualizados)
        .eq('id', usuario.id);
        
      if (error) {
        console.error('Erro ao atualizar usuário:', error);
        toast.error('Erro ao atualizar usuário');
        setOperacaoEmAndamento(false);
        return;
      }
      
      // Atualizar a lista local
      setUsuarios(prevState => 
        prevState.map(user => {
          if (user.id === usuario.id) {
            return { ...user, ...dadosAtualizados };
          }
          return user;
        })
      );
      
      setEditingUsuarioId(null);
      toast.success('Usuário atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setOperacaoEmAndamento(false);
    }
  };
  
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-4 bg-white rounded-lg shadow mb-6">
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <p className="text-center text-gray-600">Carregando dados de usuários...</p>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Gerenciamento de Usuários</h1>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Filtros */}
          <div className="p-4 bg-gray-50 border-b">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Usuário</label>
                <div className="relative">
                  <input
                    type="text"
                    value={filtroUsuarioNome}
                    onChange={(e) => setFiltroUsuarioNome(e.target.value)}
                    placeholder="Buscar por nome..."
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 pl-10"
                  />
                  <FaSearch className="absolute left-3 top-3 text-gray-400" />
                </div>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ</label>
                <input
                  type="text"
                  value={filtroUsuarioCpfCnpj}
                  onChange={(e) => setFiltroUsuarioCpfCnpj(e.target.value)}
                  placeholder="CPF ou CNPJ"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={limparFiltros}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          </div>
          
          {/* Estatísticas */}
          <div className="bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4 flex flex-col justify-between">
              <div className="text-blue-700 text-sm font-medium">Total de Usuários</div>
              <div className="text-3xl font-bold text-blue-900">{totalUsuarios}</div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 flex flex-col justify-between">
              <div className="text-purple-700 text-sm font-medium">Administradores</div>
              <div className="text-3xl font-bold text-purple-900">{totalAdmins}</div>
            </div>
          </div>
          
          {/* Tabela de Usuários */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CPF/CNPJ
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefone
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Administrador
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usuariosFiltrados.length > 0 ? (
                  usuariosFiltrados.map((usuario) => (
                    <tr key={usuario.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingUsuarioId === usuario.id ? (
                          <input
                            type="text"
                            defaultValue={usuario.nome_completo}
                            onChange={(e) => {
                              usuario.nome_completo = e.target.value;
                            }}
                            className="w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                          />
                        ) : (
                          <div className="text-sm font-medium text-gray-900">{usuario.nome_completo}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingUsuarioId === usuario.id ? (
                          <input
                            type="email"
                            defaultValue={usuario.email}
                            onChange={(e) => {
                              usuario.email = e.target.value;
                            }}
                            className="w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                          />
                        ) : (
                          <div className="text-sm text-gray-500">{usuario.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingUsuarioId === usuario.id ? (
                          <input
                            type="text"
                            defaultValue={usuario.cpf_cnpj}
                            onChange={(e) => {
                              usuario.cpf_cnpj = e.target.value;
                            }}
                            className="w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                          />
                        ) : (
                          <div className="text-sm text-gray-500">{usuario.cpf_cnpj}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingUsuarioId === usuario.id ? (
                          <input
                            type="text"
                            defaultValue={usuario.telefone}
                            onChange={(e) => {
                              usuario.telefone = e.target.value;
                            }}
                            className="w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                          />
                        ) : (
                          <div className="text-sm text-gray-500">{usuario.telefone || "—"}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <button
                            onClick={() => toggleUsuarioMaster(usuario.id, usuario.master as 'S' | 'N')}
                            disabled={operacaoEmAndamento}
                            className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                              usuario.master === 'S'
                                ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {usuario.master === 'S' ? (
                              <>
                                <FaLock className="w-3 h-3" /> Admin
                              </>
                            ) : (
                              <>
                                <FaUnlock className="w-3 h-3" /> Usuário
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          {editingUsuarioId === usuario.id ? (
                            <>
                              <button
                                onClick={() => salvarEdicaoUsuario(usuario)}
                                disabled={operacaoEmAndamento}
                                className="text-blue-600 hover:text-blue-900"
                                title="Salvar alterações"
                              >
                                <FaSave className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelarEdicaoUsuario}
                                disabled={operacaoEmAndamento}
                                className="text-gray-600 hover:text-gray-900"
                                title="Cancelar edição"
                              >
                                <FaUndo className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => iniciarEdicaoUsuario(usuario.id)}
                                disabled={operacaoEmAndamento}
                                className="text-blue-600 hover:text-blue-900"
                                title="Editar usuário"
                              >
                                <FaEdit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => excluirUsuario(usuario.id)}
                                disabled={operacaoEmAndamento}
                                className="text-red-600 hover:text-red-900"
                                title="Excluir usuário"
                              >
                                <FaTrash className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Nenhum usuário encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
} 