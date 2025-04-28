'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaPlus, FaTrash } from 'react-icons/fa';
import Layout from '@/components/Layout';
import { getUsuarioLogado } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

// Função para criar cliente admin similar à do painel administrativo
const criarClienteAdmin = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('Variáveis de ambiente do Supabase não configuradas');
    return supabase;
  }
  
  const { createClient } = require('@supabase/supabase-js');
  
  try {
    const clienteAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'x-client-info': 'admin-dashboard'
        }
      }
    });
    
    return clienteAdmin;
  } catch (error) {
    console.error('Erro ao criar cliente admin:', error);
    return supabase;
  }
};

type NumeroSorte = {
  id: string;
  documento_id: string;
  numero_sorte: string;
  created_at: string;
};

type Documento = {
  id: string;
  usuario_id: string;
  tipo: string;
  numero_documento: string;
  data_emissao: string;
  valor: number;
  arquivo_url: string;
  numero_sorteio: string;
  status: string;
  created_at: string;
  usuarios?: {
    nome_completo: string;
    email: string;
    cpf_cnpj: string;
  }
};

export default function NumerosSorteDocumento({ params }: { params: { documento_id: string } }) {
  const router = useRouter();
  const documentoId = params.documento_id;
  const [isLoading, setIsLoading] = useState(true);
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [numerosSorte, setNumerosSorte] = useState<NumeroSorte[]>([]);
  const [novoNumero, setNovoNumero] = useState('');
  
  useEffect(() => {
    const verificarUsuarioMaster = async () => {
      try {
        const usuario = await getUsuarioLogado();
        
        if (!usuario) {
          console.log('Usuário não autenticado, redirecionando para login');
          router.push('/login');
          return;
        }
        
        if (usuario.master !== 'S') {
          console.log('Usuário não tem permissão de administrador');
          router.push('/dashboard');
          return;
        }
        
        await carregarDados();
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        router.push('/dashboard');
      }
    };
    
    verificarUsuarioMaster();
  }, [documentoId, router]);
  
  const carregarDados = async () => {
    try {
      const adminClient = await criarClienteAdmin();
      
      // Carregar dados do documento
      const { data: documentoData, error: documentoError } = await adminClient
        .from('documentos')
        .select('*, usuarios(*)')
        .eq('id', documentoId)
        .single();
      
      if (documentoError) {
        console.error('Erro ao carregar documento:', documentoError);
        throw documentoError;
      }
      
      setDocumento(documentoData);
      
      // Carregar números da sorte do documento
      const { data: numerosData, error: numerosError } = await adminClient
        .from('numeros_sorte_documento')
        .select('*')
        .eq('documento_id', documentoId)
        .order('created_at', { ascending: false });
      
      if (numerosError) {
        console.error('Erro ao carregar números da sorte:', numerosError);
        throw numerosError;
      }
      
      setNumerosSorte(numerosData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    }
  };
  
  const adicionarNumeroSorte = async () => {
    if (!documento) return;
    
    if (!novoNumero.trim()) {
      toast.error('Digite um número da sorte');
      return;
    }
    
    try {
      setIsLoading(true);
      const adminClient = await criarClienteAdmin();
      
      const numeroSorteData = {
        documento_id: documentoId,
        numero_sorte: novoNumero.trim()
      };
      
      const { error } = await adminClient
        .from('numeros_sorte_documento')
        .insert(numeroSorteData);
      
      if (error) {
        throw error;
      }
      
      toast.success('Número da sorte adicionado com sucesso');
      setNovoNumero('');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao adicionar número da sorte:', error);
      toast.error('Erro ao adicionar número da sorte');
    } finally {
      setIsLoading(false);
    }
  };
  
  const removerNumeroSorte = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este número da sorte?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const adminClient = await criarClienteAdmin();
      
      const { error } = await adminClient
        .from('numeros_sorte_documento')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      toast.success('Número da sorte excluído com sucesso');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao excluir número da sorte:', error);
      toast.error('Erro ao excluir número da sorte');
    } finally {
      setIsLoading(false);
    }
  };
  
  const gerarNumeroAleatorio = () => {
    // Gerar número aleatório para sorteio (entre 000000000 e 999999999)
    const numeroSorteio = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    setNovoNumero(numeroSorteio);
  };

  return (
    <Layout isAuthenticated>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              >
                <FaArrowLeft size={20} />
              </button>
              <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                Números da Sorte do Documento
              </h1>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Voltar para o Painel
            </button>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : documento ? (
            <div>
              <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h2 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-300">Informações do Documento</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Tipo:</p>
                    <p className="font-medium">{documento.tipo.replace('_', ' ').toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Número:</p>
                    <p className="font-medium">{documento.numero_documento}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Data de Emissão:</p>
                    <p className="font-medium">{new Date(documento.data_emissao).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Valor:</p>
                    <p className="font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(documento.valor)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Status:</p>
                    <p className="font-medium">{documento.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Contribuinte:</p>
                    <p className="font-medium">{documento.usuarios?.nome_completo || 'N/A'}</p>
                    <p className="text-sm text-gray-500">{documento.usuarios?.cpf_cnpj || 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-4 text-blue-700 dark:text-blue-400">Adicionar Número da Sorte</h2>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={novoNumero}
                    onChange={(e) => setNovoNumero(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="Digite o número da sorte"
                  />
                  <button
                    onClick={gerarNumeroAleatorio}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                  >
                    Gerar Aleatório
                  </button>
                  <button
                    onClick={adicionarNumeroSorte}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center"
                  >
                    <FaPlus className="mr-2" /> Adicionar
                  </button>
                </div>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mb-4 text-blue-700 dark:text-blue-400">
                  Números da Sorte ({numerosSorte.length})
                </h2>
                
                {numerosSorte.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md text-center">
                    <p className="text-gray-600 dark:text-gray-300">
                      Nenhum número da sorte atribuído a este documento.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700 text-left">
                          <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-600">Número da Sorte</th>
                          <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-600">Data de Criação</th>
                          <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-600">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {numerosSorte.map((numero) => (
                          <tr key={numero.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 font-mono">
                              {numero.numero_sorte}
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              {new Date(numero.created_at).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              <button
                                onClick={() => removerNumeroSorte(numero.id)}
                                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
              <p className="text-red-600 dark:text-red-400">
                Documento não encontrado ou você não tem permissão para acessá-lo.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 