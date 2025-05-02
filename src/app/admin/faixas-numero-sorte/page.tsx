'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';
import AdminLayout from '@/components/AdminLayout';
import { getUsuarioLogado } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { FaixaNumeroSorte } from '@/types/supabase';

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

export default function AdminFaixasNumeroSorte() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [faixas, setFaixas] = useState<FaixaNumeroSorte[]>([]);
  const [editingFaixaId, setEditingFaixaId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    descricao: '',
    valor_de: '',
    valor_ate: '',
    quantidade_numeros: ''
  });
  const [isAdding, setIsAdding] = useState(false);

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
        
        await carregarFaixas();
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        router.push('/dashboard');
      }
    };
    
    verificarUsuarioMaster();
  }, [router]);

  const carregarFaixas = async () => {
    try {
      const adminClient = await criarClienteAdmin();
      
      const { data, error } = await adminClient
        .from('faixas_numero_sorte')
        .select('*')
        .order('valor_de', { ascending: true });
      
      if (error) {
        console.error('Erro ao carregar faixas:', error);
        throw error;
      }
      
      setFaixas(data || []);
    } catch (error) {
      console.error('Erro ao carregar faixas:', error);
      toast.error('Erro ao carregar faixas de números da sorte');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (faixa: FaixaNumeroSorte) => {
    setEditingFaixaId(faixa.id);
    setFormData({
      descricao: faixa.descricao,
      valor_de: faixa.valor_de.toString(),
      valor_ate: faixa.valor_ate.toString(),
      quantidade_numeros: faixa.quantidade_numeros.toString()
    });
  };

  const handleCancelEdit = () => {
    setEditingFaixaId(null);
    setIsAdding(false);
    setFormData({
      descricao: '',
      valor_de: '',
      valor_ate: '',
      quantidade_numeros: ''
    });
  };

  const handleAddNew = () => {
    setIsAdding(true);
    setFormData({
      descricao: '',
      valor_de: '',
      valor_ate: '',
      quantidade_numeros: '1'
    });
  };

  const validarFormulario = () => {
    const valorDe = parseFloat(formData.valor_de.replace(',', '.'));
    const valorAte = parseFloat(formData.valor_ate.replace(',', '.'));
    const quantidadeNumeros = parseInt(formData.quantidade_numeros);
    
    if (!formData.descricao.trim()) {
      toast.error('A descrição é obrigatória');
      return false;
    }
    
    if (isNaN(valorDe) || isNaN(valorAte) || isNaN(quantidadeNumeros)) {
      toast.error('Valores numéricos inválidos');
      return false;
    }
    
    if (valorDe < 0 || valorAte < 0) {
      toast.error('Os valores não podem ser negativos');
      return false;
    }
    
    if (valorDe >= valorAte) {
      toast.error('O valor inicial deve ser menor que o valor final');
      return false;
    }
    
    if (quantidadeNumeros <= 0) {
      toast.error('A quantidade de números deve ser maior que zero');
      return false;
    }
    
    // Verificar sobreposição com outras faixas, exceto a que está sendo editada
    const faixaId = editingFaixaId;
    const outrasFaixas = faixas.filter(f => f.id !== faixaId);
    
    for (const faixa of outrasFaixas) {
      // Verificando sobreposição
      if (
        (valorDe >= faixa.valor_de && valorDe <= faixa.valor_ate) ||
        (valorAte >= faixa.valor_de && valorAte <= faixa.valor_ate) ||
        (valorDe <= faixa.valor_de && valorAte >= faixa.valor_ate)
      ) {
        toast.error(`Sobreposição com a faixa ${faixa.descricao} (${faixa.valor_de} - ${faixa.valor_ate})`);
        return false;
      }
    }
    
    return true;
  };

  const handleSave = async () => {
    if (!validarFormulario()) {
      return;
    }
    
    try {
      setIsLoading(true);
      const adminClient = await criarClienteAdmin();
      
      const faixaData = {
        descricao: formData.descricao,
        valor_de: parseFloat(formData.valor_de.replace(',', '.')),
        valor_ate: parseFloat(formData.valor_ate.replace(',', '.')),
        quantidade_numeros: parseInt(formData.quantidade_numeros)
      };
      
      if (isAdding) {
        // Adicionar nova faixa
        const { error } = await adminClient
          .from('faixas_numero_sorte')
          .insert(faixaData);
        
        if (error) {
          throw error;
        }
        
        toast.success('Faixa de números adicionada com sucesso');
      } else if (editingFaixaId) {
        // Atualizar faixa existente
        const { error } = await adminClient
          .from('faixas_numero_sorte')
          .update(faixaData)
          .eq('id', editingFaixaId);
        
        if (error) {
          throw error;
        }
        
        toast.success('Faixa de números atualizada com sucesso');
      }
      
      handleCancelEdit();
      await carregarFaixas();
    } catch (error) {
      console.error('Erro ao salvar faixa:', error);
      toast.error('Erro ao salvar faixa de números');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta faixa?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const adminClient = await criarClienteAdmin();
      
      const { error } = await adminClient
        .from('faixas_numero_sorte')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      toast.success('Faixa de números excluída com sucesso');
      await carregarFaixas();
    } catch (error) {
      console.error('Erro ao excluir faixa:', error);
      toast.error('Erro ao excluir faixa de números');
    } finally {
      setIsLoading(false);
    }
  };

  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Faixas de Números da Sorte</h1>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Configuração das Faixas</h2>
            {!isAdding && !editingFaixaId && (
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                disabled={isLoading}
              >
                <FaPlus className="mr-2" /> Nova Faixa
              </button>
            )}
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700 text-left">
                      <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-600">Descrição</th>
                      <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-600">Valor De (R$)</th>
                      <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-600">Valor Até (R$)</th>
                      <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-600">Qtd. Números Sorte</th>
                      <th className="px-6 py-3 border-b border-gray-200 dark:border-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isAdding && (
                      <tr className="bg-blue-50 dark:bg-blue-900/20">
                        <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                          <input 
                            type="text" 
                            name="descricao" 
                            value={formData.descricao} 
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            placeholder="Descrição da faixa"
                          />
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                          <input 
                            type="text" 
                            name="valor_de" 
                            value={formData.valor_de} 
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            placeholder="0,00"
                          />
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                          <input 
                            type="text" 
                            name="valor_ate" 
                            value={formData.valor_ate} 
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            placeholder="0,00"
                          />
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                          <input 
                            type="number" 
                            name="quantidade_numeros" 
                            value={formData.quantidade_numeros} 
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            min="1"
                          />
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex space-x-2">
                            <button 
                              onClick={handleSave}
                              className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                            >
                              <FaSave className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={handleCancelEdit}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <FaTimes className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    
                    {faixas.map((faixa) => (
                      <tr 
                        key={faixa.id} 
                        className={editingFaixaId === faixa.id 
                          ? "bg-blue-50 dark:bg-blue-900/20" 
                          : "hover:bg-gray-50 dark:hover:bg-gray-700"
                        }
                      >
                        {editingFaixaId === faixa.id ? (
                          <>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              <input 
                                type="text" 
                                name="descricao" 
                                value={formData.descricao} 
                                onChange={handleChange}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                              />
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              <input 
                                type="text" 
                                name="valor_de" 
                                value={formData.valor_de} 
                                onChange={handleChange}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                              />
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              <input 
                                type="text" 
                                name="valor_ate" 
                                value={formData.valor_ate} 
                                onChange={handleChange}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                              />
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              <input 
                                type="number" 
                                name="quantidade_numeros" 
                                value={formData.quantidade_numeros} 
                                onChange={handleChange}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                min="1"
                              />
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              <div className="flex space-x-2">
                                <button 
                                  onClick={handleSave}
                                  className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                >
                                  <FaSave className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={handleCancelEdit}
                                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <FaTimes className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              {faixa.descricao}
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              R$ {formatarValor(faixa.valor_de)}
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              R$ {formatarValor(faixa.valor_ate)}
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              {faixa.quantidade_numeros}
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              <div className="flex space-x-2">
                                <button 
                                  onClick={() => handleEdit(faixa)}
                                  disabled={isAdding || editingFaixaId !== null}
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <FaEdit className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(faixa.id)}
                                  disabled={isAdding || editingFaixaId !== null}
                                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <FaTrash className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    
                    {faixas.length === 0 && !isAdding && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center border-b border-gray-200 dark:border-gray-700">
                          Nenhuma faixa de números da sorte cadastrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md">
            <h3 className="text-lg font-medium mb-2 text-blue-700 dark:text-blue-400">Informações</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>As faixas de valores não podem se sobrepor</li>
              <li>A quantidade de números da sorte determina quantos números serão gerados para um documento quando for validado</li>
              <li>Quando um documento é validado, o sistema verifica em qual faixa de valor ele se encaixa e gera automaticamente a quantidade correspondente de números da sorte</li>
            </ul>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
} 