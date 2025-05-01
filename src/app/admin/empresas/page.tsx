'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaBuilding, FaEdit, FaPlus, FaTrash, FaCheck, FaTimesCircle, FaExclamationCircle } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/AdminLayout';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Tooltip from '@/components/ui/Tooltip';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';

interface Empresa {
  id: string;
  nome_razao_social: string;
  cnpj: string;
  endereco: string;
  bairro: string;
  municipio: string;
  cep: string;
  uf: string;
  status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO';
  created_at: string;
}

export default function GerenciamentoEmpresas() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [modalEmpresaAberto, setModalEmpresaAberto] = useState(false);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [empresaAtual, setEmpresaAtual] = useState<Empresa | null>(null);
  const [formData, setFormData] = useState({
    nome_razao_social: '',
    cnpj: '',
    endereco: '',
    bairro: '',
    municipio: '',
    cep: '',
    uf: '',
    status: 'ATIVO' as 'ATIVO' | 'INATIVO' | 'BLOQUEADO'
  });

  useEffect(() => {
    const verificarAutenticacao = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast.error('Você precisa estar logado como administrador para acessar esta página');
          router.push('/login');
          return;
        }
        
        // Verificar se o usuário é administrador
        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('master')
          .eq('id', session.user.id)
          .single();
          
        if (userError || !userData || userData.master !== 'S') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }
        
        // Carregar lista de empresas
        await carregarEmpresas();
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        toast.error('Erro ao verificar autenticação');
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };
    
    verificarAutenticacao();
  }, [router]);

  const carregarEmpresas = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('empresa')
        .select('*')
        .order('nome_razao_social', { ascending: true });
      
      if (error) throw error;
      
      setEmpresas(data || []);
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
      toast.error('Erro ao carregar a lista de empresas');
    } finally {
      setIsLoading(false);
    }
  };

  const abrirModalNovaEmpresa = () => {
    setEmpresaAtual(null);
    setFormData({
      nome_razao_social: '',
      cnpj: '',
      endereco: '',
      bairro: '',
      municipio: '',
      cep: '',
      uf: '',
      status: 'ATIVO'
    });
    setModalEmpresaAberto(true);
  };

  const abrirModalEditarEmpresa = (empresa: Empresa) => {
    setEmpresaAtual(empresa);
    setFormData({
      nome_razao_social: empresa.nome_razao_social,
      cnpj: empresa.cnpj,
      endereco: empresa.endereco || '',
      bairro: empresa.bairro || '',
      municipio: empresa.municipio || '',
      cep: empresa.cep || '',
      uf: empresa.uf || '',
      status: empresa.status
    });
    setModalEmpresaAberto(true);
  };

  const abrirModalExcluirEmpresa = (empresa: Empresa) => {
    setEmpresaAtual(empresa);
    setModalExcluirAberto(true);
  };

  const consultarCep = async (cep: string) => {
    if (cep.length < 8) return;
    
    try {
      // Remover caracteres não numéricos
      const cepLimpo = cep.replace(/\D/g, '');
      
      // Fazer consulta ao ViaCEP
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }
      
      // Preencher os campos com os dados retornados
      setFormData(prev => ({
        ...prev,
        endereco: data.logradouro || prev.endereco,
        bairro: data.bairro || prev.bairro,
        municipio: data.localidade || prev.municipio,
        uf: data.uf || prev.uf
      }));
      
      toast.success('CEP encontrado');
    } catch (error) {
      console.error('Erro ao consultar CEP:', error);
      toast.error('Erro ao consultar CEP');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'cep' && value.length === 9) {
      // Se o CEP estiver completo, consultar automaticamente
      consultarCep(value);
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCepBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value;
    if (cep.length >= 8) {
      consultarCep(cep);
    }
  };

  const formatarCnpj = (valor: string) => {
    // Remove todos os caracteres não numéricos
    const numeros = valor.replace(/\D/g, '');
    
    // Limita a 14 dígitos
    const cnpjLimitado = numeros.slice(0, 14);
    
    // Aplica a máscara do CNPJ (XX.XXX.XXX/XXXX-XX)
    let cnpjFormatado = cnpjLimitado;
    if (cnpjLimitado.length > 2) {
      cnpjFormatado = cnpjLimitado.replace(/^(\d{2})(\d)/, '$1.$2');
    }
    if (cnpjLimitado.length > 5) {
      cnpjFormatado = cnpjFormatado.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    }
    if (cnpjLimitado.length > 8) {
      cnpjFormatado = cnpjFormatado.replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4');
    }
    if (cnpjLimitado.length > 12) {
      cnpjFormatado = cnpjFormatado.replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    
    return cnpjFormatado;
  };

  const formatarCep = (valor: string) => {
    // Remove todos os caracteres não numéricos
    const numeros = valor.replace(/\D/g, '');
    
    // Limita a 8 dígitos
    const cepLimitado = numeros.slice(0, 8);
    
    // Aplica a máscara do CEP (XXXXX-XXX)
    let cepFormatado = cepLimitado;
    if (cepLimitado.length > 5) {
      cepFormatado = cepLimitado.replace(/^(\d{5})(\d)/, '$1-$2');
    }
    
    return cepFormatado;
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const cnpjFormatado = formatarCnpj(value);
    setFormData(prev => ({ ...prev, cnpj: cnpjFormatado }));
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const cepFormatado = formatarCep(value);
    setFormData(prev => ({ ...prev, cep: cepFormatado }));
  };

  const salvarEmpresa = async () => {
    try {
      setIsLoading(true);
      
      // Validação dos campos obrigatórios
      if (!formData.nome_razao_social || !formData.cnpj) {
        toast.error('Preencha todos os campos obrigatórios');
        setIsLoading(false);
        return;
      }
      
      // Formatação do CNPJ (remove caracteres não numéricos)
      const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
      
      // Verificar se o CNPJ já existe (exceto para a empresa atual que está sendo editada)
      const { data: empresaExistente, error: errorCheck } = await supabase
        .from('empresa')
        .select('id')
        .eq('cnpj', cnpjLimpo)
        .not('id', empresaAtual?.id || '');
      
      if (!errorCheck && empresaExistente && empresaExistente.length > 0) {
        toast.error('CNPJ já cadastrado');
        setIsLoading(false);
        return;
      }
      
      if (empresaAtual) {
        // Atualizar empresa existente
        const { error } = await supabase
          .from('empresa')
          .update({
            nome_razao_social: formData.nome_razao_social,
            cnpj: cnpjLimpo,
            endereco: formData.endereco,
            bairro: formData.bairro,
            municipio: formData.municipio,
            cep: formData.cep,
            uf: formData.uf,
            status: formData.status
          })
          .eq('id', empresaAtual.id);
        
        if (error) throw error;
        
        toast.success('Empresa atualizada com sucesso');
      } else {
        // Criar nova empresa
        const { error } = await supabase
          .from('empresa')
          .insert({
            nome_razao_social: formData.nome_razao_social,
            cnpj: cnpjLimpo,
            endereco: formData.endereco,
            bairro: formData.bairro,
            municipio: formData.municipio,
            cep: formData.cep,
            uf: formData.uf,
            status: formData.status
          });
        
        if (error) throw error;
        
        toast.success('Empresa cadastrada com sucesso');
      }
      
      setModalEmpresaAberto(false);
      carregarEmpresas();
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
      toast.error('Erro ao salvar empresa');
    } finally {
      setIsLoading(false);
    }
  };

  const excluirEmpresa = async () => {
    if (!empresaAtual) return;
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('empresa')
        .delete()
        .eq('id', empresaAtual.id);
      
      if (error) throw error;
      
      toast.success('Empresa excluída com sucesso');
      setModalExcluirAberto(false);
      carregarEmpresas();
    } catch (error) {
      console.error('Erro ao excluir empresa:', error);
      toast.error('Erro ao excluir empresa');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ATIVO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <FaCheck className="mr-1" /> Ativo
          </span>
        );
      case 'INATIVO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <FaExclamationCircle className="mr-1" /> Inativo
          </span>
        );
      case 'BLOQUEADO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <FaTimesCircle className="mr-1" /> Bloqueado
          </span>
        );
      default:
        return status;
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gerenciamento de Empresas</h1>
        <Button
          variant="primary"
          icon={FaPlus}
          onClick={abrirModalNovaEmpresa}
          isLoading={isLoading}
          className="whitespace-nowrap"
        >
          Nova Empresa
        </Button>
      </div>
      
      <Card>
        {isLoading ? (
          <div className="py-10 text-center">
            <div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-500">Carregando empresas...</p>
          </div>
        ) : empresas.length === 0 ? (
          <div className="py-10 text-center">
            <FaBuilding className="text-4xl text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">Nenhuma empresa cadastrada</p>
            <Button
              variant="secondary"
              icon={FaPlus}
              onClick={abrirModalNovaEmpresa}
              className="mt-2"
            >
              Cadastrar Empresa
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Empresa
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CNPJ
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Município
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {empresas.map((empresa) => (
                  <tr key={empresa.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{empresa.nome_razao_social}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">{empresa.cnpj}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {empresa.municipio} {empresa.uf ? `- ${empresa.uf}` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderStatusBadge(empresa.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Tooltip content="Editar empresa">
                        <button 
                          onClick={() => abrirModalEditarEmpresa(empresa)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <FaEdit />
                        </button>
                      </Tooltip>
                      <Tooltip content="Excluir empresa">
                        <button 
                          onClick={() => abrirModalExcluirEmpresa(empresa)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FaTrash />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      
      {/* Modal de cadastro/edição de empresa */}
      <Modal
        isOpen={modalEmpresaAberto}
        onClose={() => setModalEmpresaAberto(false)}
        title={empresaAtual ? 'Editar Empresa' : 'Nova Empresa'}
      >
        <div className="space-y-4">
          <Input
            label="Razão Social/Nome da Empresa *"
            id="nome_razao_social"
            name="nome_razao_social"
            value={formData.nome_razao_social}
            onChange={handleChange}
            required
          />
          
          <Input
            label="CNPJ *"
            id="cnpj"
            name="cnpj"
            value={formData.cnpj}
            onChange={handleCnpjChange}
            placeholder="00.000.000/0000-00"
            required
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="CEP"
              id="cep"
              name="cep"
              value={formData.cep}
              onChange={handleCepChange}
              onBlur={handleCepBlur}
              placeholder="00000-000"
            />
            
            <Input
              label="UF"
              id="uf"
              name="uf"
              value={formData.uf}
              onChange={handleChange}
              maxLength={2}
            />
          </div>
          
          <Input
            label="Endereço"
            id="endereco"
            name="endereco"
            value={formData.endereco}
            onChange={handleChange}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Bairro"
              id="bairro"
              name="bairro"
              value={formData.bairro}
              onChange={handleChange}
            />
            
            <Input
              label="Município"
              id="municipio"
              name="municipio"
              value={formData.municipio}
              onChange={handleChange}
            />
          </div>
          
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
              <option value="BLOQUEADO">Bloqueado</option>
            </select>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              variant="secondary" 
              onClick={() => setModalEmpresaAberto(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button 
              variant="primary" 
              onClick={salvarEmpresa}
              isLoading={isLoading}
            >
              {empresaAtual ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Modal de confirmação de exclusão */}
      <Modal
        isOpen={modalExcluirAberto}
        onClose={() => setModalExcluirAberto(false)}
        title="Excluir Empresa"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Tem certeza que deseja excluir a empresa <strong>{empresaAtual?.nome_razao_social}</strong>?
          </p>
          <p className="text-sm text-red-600">
            Esta ação não poderá ser desfeita.
          </p>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              variant="secondary" 
              onClick={() => setModalExcluirAberto(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button 
              variant="danger" 
              onClick={excluirEmpresa}
              isLoading={isLoading}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
} 