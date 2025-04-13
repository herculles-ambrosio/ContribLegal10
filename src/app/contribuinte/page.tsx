'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { FaPlus, FaFileAlt, FaMoneyBillWave, FaReceipt, FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaTrophy, FaFileContract } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { getUsuarioLogado } from '@/lib/auth';

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
};

type Estatisticas = {
  totalDocumentos: number;
  totalValidados: number;
  totalPendentes: number;
  valorTotal: number;
  documentosPorTipo: Record<string, number>;
};

export default function PainelContribuinte() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [documentosRecentes, setDocumentosRecentes] = useState<Documento[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    totalDocumentos: 0,
    totalValidados: 0,
    totalPendentes: 0,
    valorTotal: 0,
    documentosPorTipo: {}
  });

  useEffect(() => {
    const verificarAutenticacao = async () => {
      try {
        const usuario = await getUsuarioLogado();
        
        if (!usuario) {
          toast.error('Você precisa estar logado para acessar esta página');
          router.push('/login');
          return;
        }
        
        // Verificar se o usuário é administrador
        if (usuario.master === 'S') {
          console.log('Usuário é administrador, redirecionando para o painel administrativo');
          router.push('/admin');
          return;
        }
        
        setNomeUsuario(usuario.nome_completo || '');
        
        await carregarDados();
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        toast.error('Erro ao verificar autenticação');
        router.push('/login');
      }
    };
    
    verificarAutenticacao();
  }, [router]);

  const carregarDados = async () => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      // Carregar todos os documentos do usuário
      const { data: documentos, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('usuario_id', session.user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Calcular estatísticas
      if (documentos && documentos.length > 0) {
        // Documentos recentes
        setDocumentosRecentes(documentos.slice(0, 3));
        
        // Total de documentos
        const totalDocumentos = documentos.length;
        
        // Documentos por status
        const totalValidados = documentos.filter(doc => doc.status === 'VALIDADO').length;
        const totalPendentes = documentos.filter(doc => doc.status === 'AGUARDANDO VALIDAÇÃO').length;
        
        // Valor total
        const valorTotal = documentos.reduce((total, doc) => {
          let valor = 0;
          if (typeof doc.valor === 'number') {
            valor = doc.valor;
          } else if (typeof doc.valor === 'string') {
            valor = parseFloat(doc.valor.replace(',', '.')) || 0;
          }
          return total + valor;
        }, 0);
        
        // Documentos por tipo
        const documentosPorTipo = documentos.reduce((acc: Record<string, number>, doc) => {
          const tipo = doc.tipo || 'OUTRO';
          acc[tipo] = (acc[tipo] || 0) + 1;
          return acc;
        }, {});
        
        setEstatisticas({
          totalDocumentos,
          totalValidados,
          totalPendentes,
          valorTotal,
          documentosPorTipo
        });
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar seus dados');
    } finally {
      setIsLoading(false);
    }
  };

  const getTipoDocumento = (tipo: string) => {
    switch (tipo) {
      case 'nota_servico':
        return {
          label: 'Nota Fiscal de Serviço',
          icon: FaFileContract
        };
      case 'cupom_fiscal':
        return {
          label: 'Cupom Fiscal',
          icon: FaReceipt
        };
      case 'nota_venda':
        return {
          label: 'Cupom Fiscal',
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
          icon: FaCheckCircle,
          iconColor: 'text-green-500'
        };
      case 'INVÁLIDO':
        return {
          color: 'bg-red-100 text-red-800',
          icon: FaTimesCircle,
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

  return (
    <Layout isAuthenticated>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Painel do Contribuinte</h1>
        <p className="text-gray-600">
          Bem-vindo(a) ao seu painel, {nomeUsuario}
        </p>
      </div>
      
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium mb-1">Total de Cupons</h3>
              {isLoading ? (
                <div className="animate-pulse h-8 w-20 bg-white/20 rounded"></div>
              ) : (
                <p className="text-3xl font-bold">{estatisticas.totalDocumentos}</p>
              )}
              <p className="text-sm opacity-80">Documentos cadastrados</p>
            </div>
            <FaFileAlt className="text-4xl opacity-80" />
          </div>
        </Card>
        
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium mb-1">Cupons Validados</h3>
              {isLoading ? (
                <div className="animate-pulse h-8 w-20 bg-white/20 rounded"></div>
              ) : (
                <p className="text-3xl font-bold">{estatisticas.totalValidados}</p>
              )}
              <p className="text-sm opacity-80">Aptos para sorteio</p>
            </div>
            <FaCheckCircle className="text-4xl opacity-80" />
          </div>
        </Card>
        
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium mb-1">Valor Total</h3>
              {isLoading ? (
                <div className="animate-pulse h-8 w-36 bg-white/20 rounded"></div>
              ) : (
                <p className="text-3xl font-bold">{formatarValor(estatisticas.valorTotal)}</p>
              )}
              <p className="text-sm opacity-80">Documentos cadastrados</p>
            </div>
            <FaMoneyBillWave className="text-4xl opacity-80" />
          </div>
        </Card>
      </div>
      
      {/* Próximo sorteio e Documentos recentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card title="Próximo Sorteio">
          <div className="p-4 text-center">
            <FaTrophy className="text-4xl text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Estatísticas para Sorteio</h3>
            <p className="text-gray-600 mb-4">
              Você tem {estatisticas.totalValidados} documentos validados 
              para o próximo sorteio.
            </p>
            <p className="bg-yellow-50 text-yellow-700 p-2 rounded border border-yellow-200 text-sm">
              O próximo sorteio ocorrerá dia <strong>21/12/2025</strong>
            </p>
          </div>
        </Card>
        
        <Card title="Documentos Recentes">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          ) : documentosRecentes.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 mb-4">Você ainda não cadastrou nenhum documento.</p>
              <Link href="/meus-documentos/cadastrar">
                <Button variant="primary" icon={FaPlus} className="text-sm">
                  Cadastrar Documento
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {documentosRecentes.map((doc) => {
                const tipo = getTipoDocumento(doc.tipo);
                const statusConfig = getStatusConfig(doc.status);
                const StatusIcon = statusConfig.icon;
                
                return (
                  <div key={doc.id} className="py-3 px-4">
                    <div className="flex items-center">
                      <tipo.icon className="text-blue-500 mr-3" />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-800">{tipo.label}</h4>
                            <p className="text-sm text-gray-500">
                              {formatarData(doc.data_emissao)} • {formatarValor(doc.valor)}
                            </p>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                            <StatusIcon className={`mr-1 ${statusConfig.iconColor}`} />
                            {doc.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="py-3 px-4 text-center">
                <Link href="/meus-documentos">
                  <Button variant="secondary" className="text-sm">
                    Ver Todos os Documentos
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
      
      {/* Acesso rápido */}
      <Card title="Acesso Rápido">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
          <Link href="/meus-documentos/cadastrar">
            <div className="bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg p-4 text-center">
              <FaPlus className="text-3xl text-blue-500 mx-auto mb-3" />
              <h3 className="font-medium">Cadastrar Documento</h3>
              <p className="text-sm text-gray-600 mt-1">Adicionar nova nota fiscal</p>
            </div>
          </Link>
          
          <Link href="/meus-documentos">
            <div className="bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg p-4 text-center">
              <FaFileAlt className="text-3xl text-green-500 mx-auto mb-3" />
              <h3 className="font-medium">Meus Documentos</h3>
              <p className="text-sm text-gray-600 mt-1">Visualizar documentos cadastrados</p>
            </div>
          </Link>
          
          <Link href="/meus-sorteios">
            <div className="bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg p-4 text-center">
              <FaTrophy className="text-3xl text-yellow-500 mx-auto mb-3" />
              <h3 className="font-medium">Meus Sorteios</h3>
              <p className="text-sm text-gray-600 mt-1">Ver números e resultados</p>
            </div>
          </Link>
        </div>
      </Card>
    </Layout>
  );
} 