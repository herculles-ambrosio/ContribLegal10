'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { FaCheck, FaTimes, FaHourglassHalf, FaEye, FaEdit, FaTrash, FaSearch, FaUser, FaFileAlt, FaMoneyBillWave, FaReceipt } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import Input from '@/components/ui/Input';
import { getUsuarioLogado, isAdmin as checkIsAdmin } from '@/lib/auth';

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
  // Adicionado dados do usuário
  usuario?: {
    nome_completo: string;
    cpf_cnpj: string;
    email: string;
  }
};

export default function ValidacaoDocumentos() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [documentosFiltrados, setDocumentosFiltrados] = useState<Documento[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('AGUARDANDO VALIDAÇÃO');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [termoBusca, setTermoBusca] = useState<string>('');
  const [documentoSelecionado, setDocumentoSelecionado] = useState<Documento | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const verificarPermissao = async () => {
      try {
        const usuario = await getUsuarioLogado();
        
        if (!usuario) {
          toast.error('Você precisa estar logado para acessar esta página');
          router.push('/login');
          return;
        }
        
        const adminStatus = await checkIsAdmin();
        setIsAdmin(adminStatus);
        
        if (adminStatus) {
          console.log('Administrador tentando acessar validação direta - redirecionando para painel admin');
          toast.success('Bem-vindo(a) ao Painel Administrativo!');
          router.push('/admin');
          return;
        }
        
        carregarDocumentos();
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        toast.error('Erro ao verificar permissões');
        router.push('/');
      }
    };
    
    verificarPermissao();
  }, [router]);
  
  useEffect(() => {
    aplicarFiltros();
  }, [filtroStatus, filtroTipo, termoBusca, documentos]);

  const carregarDocumentos = async () => {
    try {
      setIsLoading(true);
      
      // Buscar todos os documentos com detalhes dos usuários
      const { data, error } = await supabase
        .from('documentos')
        .select(`
          *,
          usuario:usuarios(nome_completo, cpf_cnpj, email)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setDocumentos(data || []);
      aplicarFiltros();
    } catch (error: any) {
      console.error('Erro ao carregar documentos:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setIsLoading(false);
    }
  };

  const aplicarFiltros = () => {
    let resultados = [...documentos];
    
    // Filtrar por status
    if (filtroStatus !== 'todos') {
      resultados = resultados.filter(doc => doc.status === filtroStatus);
    }
    
    // Filtrar por tipo
    if (filtroTipo !== 'todos') {
      resultados = resultados.filter(doc => doc.tipo === filtroTipo);
    }
    
    // Filtrar por termo de busca
    if (termoBusca.trim() !== '') {
      const termoLower = termoBusca.toLowerCase();
      resultados = resultados.filter(doc => 
        doc.numero_documento.toLowerCase().includes(termoLower) ||
        doc.usuario?.nome_completo.toLowerCase().includes(termoLower) ||
        doc.usuario?.cpf_cnpj.includes(termoLower) ||
        doc.numero_sorteio.includes(termoLower)
      );
    }
    
    setDocumentosFiltrados(resultados);
  };

  const getTipoDocumento = (tipo: string) => {
    switch (tipo) {
      case 'nota_servico':
        return {
          label: 'Nota Fiscal de Serviço',
          icon: FaFileAlt
        };
      case 'nota_venda':
        return {
          label: 'Nota Fiscal de Venda',
          icon: FaReceipt
        };
      case 'imposto':
        return {
          label: 'Comprovante de Imposto',
          icon: FaMoneyBillWave
        };
      default:
        return {
          label: 'Documento',
          icon: FaFileAlt
        };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'VALIDADO':
        return {
          color: 'bg-green-100 text-green-800',
          icon: FaCheck,
          iconColor: 'text-green-500'
        };
      case 'INVÁLIDO':
        return {
          color: 'bg-red-100 text-red-800',
          icon: FaTimes,
          iconColor: 'text-red-500'
        };
      case 'AGUARDANDO VALIDAÇÃO':
      default:
        return {
          color: 'bg-yellow-100 text-yellow-800',
          icon: FaHourglassHalf,
          iconColor: 'text-yellow-500'
        };
    }
  };

  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatarData = (dataISO: string) => {
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR');
  };

  const abrirModalValidacao = (documento: Documento) => {
    setDocumentoSelecionado(documento);
    setShowModal(true);
  };

  const fecharModal = () => {
    setDocumentoSelecionado(null);
    setShowModal(false);
  };

  const atualizarStatusDocumento = async (id: string, novoStatus: string) => {
    try {
      const { error } = await supabase
        .from('documentos')
        .update({ status: novoStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      // Atualizar o estado local
      setDocumentos(prevDocs => 
        prevDocs.map(doc => 
          doc.id === id ? { ...doc, status: novoStatus } : doc
        )
      );
      
      fecharModal();
      toast.success(`Documento ${novoStatus.toLowerCase()} com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do documento');
    }
  };

  const excluirDocumento = async (id: string) => {
    try {
      // Primeiro obter o documento para saber o arquivo
      const { data: documento, error: fetchError } = await supabase
        .from('documentos')
        .select('arquivo_url')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Excluir o documento do banco
      const { error: deleteError } = await supabase
        .from('documentos')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      
      // Excluir o arquivo do storage
      if (documento?.arquivo_url) {
        await supabase
          .storage
          .from('documentos')
          .remove([documento.arquivo_url]);
      }
      
      // Atualizar o estado local
      setDocumentos(prevDocs => prevDocs.filter(doc => doc.id !== id));
      fecharModal();
      toast.success('Documento excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir documento:', error);
      toast.error('Erro ao excluir documento');
    }
  };

  if (!isAdmin) {
    return (
      <Layout isAuthenticated>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Acesso Restrito</h2>
            <p className="text-gray-700 mb-6">
              Você não tem permissão para acessar esta página.
            </p>
            <Button 
              variant="primary" 
              onClick={() => router.push('/dashboard')}
            >
              Voltar para o Dashboard
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout isAuthenticated>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Validação de Documentos</h1>
        <p className="text-gray-600">
          Gerencie e valide os documentos cadastrados pelos contribuintes
        </p>
      </div>
      
      {/* Barra de busca e filtros */}
      <Card className="mb-6 bg-white shadow-lg rounded-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Input
                icon={FaSearch}
                placeholder="Buscar por número, contribuinte, CPF/CNPJ..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                fullWidth
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <select 
                className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                <option value="todos">Todos os status</option>
                <option value="AGUARDANDO VALIDAÇÃO">Aguardando Validação</option>
                <option value="VALIDADO">Validados</option>
                <option value="INVÁLIDO">Inválidos</option>
              </select>
            </div>
            
            <div>
              <select 
                className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="todos">Todos os tipos</option>
                <option value="nota_servico">Notas de Serviço</option>
                <option value="nota_venda">Notas de Venda</option>
                <option value="imposto">Comprovantes de Impostos</option>
              </select>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Lista de Documentos */}
      {isLoading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : documentosFiltrados.length === 0 ? (
        <Card className="bg-white shadow-lg rounded-lg">
          <div className="text-center py-8">
            <FaFileAlt className="mx-auto text-4xl text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-700 mb-2">Nenhum documento encontrado</h3>
            <p className="text-gray-500 mb-6">
              Não há documentos correspondentes aos filtros selecionados.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {documentosFiltrados.map((documento) => {
            const tipo = getTipoDocumento(documento.tipo);
            const statusConfig = getStatusConfig(documento.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <Card key={documento.id} className="bg-white shadow-md hover:shadow-lg transition-shadow rounded-lg overflow-hidden">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <div className="p-2 rounded-full bg-blue-100 mr-3">
                        <tipo.icon className="text-blue-600 text-lg" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{tipo.label}</h3>
                        <p className="text-sm text-gray-500">#{documento.numero_documento}</p>
                      </div>
                      <div className="ml-auto">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className={`mr-1 ${statusConfig.iconColor}`} />
                          {documento.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-6 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <FaUser className="text-gray-400 mr-2" />
                          <div>
                            <p className="text-xs text-gray-500">Contribuinte</p>
                            <p className="font-medium">{documento.usuario?.nome_completo}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">CPF/CNPJ: {documento.usuario?.cpf_cnpj}</p>
                        <p className="text-xs text-gray-500">Email: {documento.usuario?.email}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Data de Emissão</p>
                          <p className="font-medium">{formatarData(documento.data_emissao)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Valor</p>
                          <p className="font-medium">{formatarValor(documento.valor)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Número da Sorte</p>
                          <p className="font-medium">{documento.numero_sorteio}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-row lg:flex-col justify-end space-y-0 space-x-2 lg:space-y-2 lg:space-x-0 w-full lg:w-auto">
                    <Button 
                      variant="info" 
                      icon={FaEye}
                      onClick={() => window.open(
                        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documentos/${documento.arquivo_url}`, 
                        '_blank'
                      )}
                      className="text-sm flex-1 lg:flex-none"
                    >
                      Visualizar
                    </Button>
                    
                    <Button 
                      variant="primary" 
                      icon={FaEdit}
                      onClick={() => abrirModalValidacao(documento)}
                      className="text-sm flex-1 lg:flex-none"
                    >
                      Validar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Modal de Validação */}
      {showModal && documentoSelecionado && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">Validar Documento</h3>
              
              <div className="mb-4">
                <p className="font-medium">Tipo: {getTipoDocumento(documentoSelecionado.tipo).label}</p>
                <p className="font-medium">Número: {documentoSelecionado.numero_documento}</p>
                <p className="font-medium">Contribuinte: {documentoSelecionado.usuario?.nome_completo}</p>
                <p className="font-medium">Data de Emissão: {formatarData(documentoSelecionado.data_emissao)}</p>
                <p className="font-medium">Valor: {formatarValor(documentoSelecionado.valor)}</p>
                <p className="font-medium">Status Atual: 
                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusConfig(documentoSelecionado.status).color}`}>
                    {documentoSelecionado.status}
                  </span>
                </p>
              </div>
              
              <div className="mb-6">
                <Button 
                  variant="secondary" 
                  icon={FaEye}
                  onClick={() => window.open(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documentos/${documentoSelecionado.arquivo_url}`, 
                    '_blank'
                  )}
                  className="text-sm w-full mb-2"
                >
                  Visualizar Documento
                </Button>
              </div>
              
              <div className="flex flex-col space-y-3">
                <Button 
                  variant="success" 
                  icon={FaCheck}
                  onClick={() => atualizarStatusDocumento(documentoSelecionado.id, 'VALIDADO')}
                  className="text-sm"
                >
                  Validar Documento
                </Button>
                
                <Button 
                  variant="danger" 
                  icon={FaTimes}
                  onClick={() => atualizarStatusDocumento(documentoSelecionado.id, 'INVÁLIDO')}
                  className="text-sm"
                >
                  Marcar como Inválido
                </Button>
                
                <Button 
                  variant="warning" 
                  icon={FaHourglassHalf}
                  onClick={() => atualizarStatusDocumento(documentoSelecionado.id, 'AGUARDANDO VALIDAÇÃO')}
                  className="text-sm"
                >
                  Aguardando Validação
                </Button>
                
                <Button 
                  variant="danger" 
                  icon={FaTrash}
                  onClick={() => {
                    if (window.confirm('Tem certeza que deseja excluir este documento? Esta ação é irreversível.')) {
                      excluirDocumento(documentoSelecionado.id);
                    }
                  }}
                  className="text-sm"
                >
                  Excluir Documento
                </Button>
              </div>
              
              <div className="mt-6 text-right">
                <Button 
                  variant="secondary"
                  onClick={fecharModal}
                  className="text-sm"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
} 