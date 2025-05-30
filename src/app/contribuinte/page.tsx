'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { FaPlus, FaFileAlt, FaMoneyBillWave, FaReceipt, FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaTrophy, FaFileContract, FaExclamationTriangle, FaArrowRight } from 'react-icons/fa';
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
  const [empresaStatus, setEmpresaStatus] = useState<string>('ATIVO');
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

        // Verificar status da empresa
        try {
          const { data: empresaData, error: empresaError } = await supabase
            .from('empresa')
            .select('status')
            .single();

          if (!empresaError && empresaData && 'status' in empresaData) {
            setEmpresaStatus(empresaData.status);
            
            // Se a empresa estiver bloqueada, redirecionar para a página inicial
            if (empresaData.status === 'BLOQUEADO') {
              toast.error('O Contribuinte Legal encontra-se BLOQUEADO no momento');
              await supabase.auth.signOut();
              router.push('/');
              return;
            }
          }
        } catch (error) {
          console.error('Erro ao verificar status da empresa:', error);
        }
        
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
        .eq('usuario_id', session.user.id as any)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Calcular estatísticas
      if (documentos && documentos.length > 0) {
        // Documentos recentes
        setDocumentosRecentes(documentos.slice(0, 3) as any);
        
        // Total de documentos
        const totalDocumentos = documentos.length;
        
        // Documentos por status
        const totalValidados = documentos.filter((doc: any) => 
          doc && doc.status === 'VALIDADO'
        ).length;
        const totalPendentes = documentos.filter((doc: any) => 
          doc && doc.status === 'AGUARDANDO VALIDAÇÃO'
        ).length;
        
        // Valor total
        const valorTotal = documentos.reduce((total: number, doc: any) => {
          if (!doc || !doc.valor) return total;
          
          let valor = 0;
          if (typeof doc.valor === 'number') {
            valor = doc.valor;
          } else if (typeof doc.valor === 'string') {
            valor = parseFloat(doc.valor.replace(',', '.')) || 0;
          }
          return total + valor;
        }, 0);
        
        // Documentos por tipo
        const documentosPorTipo = documentos.reduce((acc: Record<string, number>, doc: any) => {
          if (!doc || !doc.tipo) return acc;
          
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
    try {
      if (!dataISO) return '';
      
      // Se a data vier em formato ISO, vamos preservar o dia exato
      if (dataISO.includes('T')) {
        const [dataParte] = dataISO.split('T');
        const [ano, mes, dia] = dataParte.split('-').map(num => parseInt(num, 10));
        if (ano && mes && dia) {
          return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
        }
      }
      
      // Se for apenas data (YYYY-MM-DD), dividimos e montamos diretamente
      if (dataISO.includes('-') && dataISO.split('-').length === 3) {
        const [ano, mes, dia] = dataISO.split('-').map(num => parseInt(num, 10));
        if (ano && mes && dia) {
          return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
        }
      }
      
      // Caso já esteja no formato DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataISO)) {
        return dataISO;
      }
      
      // Fallback para o método padrão (que pode ter o problema de timezone)
      return new Date(dataISO).toLocaleDateString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data:', error, dataISO);
      return dataISO; // Retornar a string original em caso de erro
    }
  };

  const navigateToDocuments = (filter?: string) => {
    if (filter) {
      router.push(`/meus-documentos?filter=${filter}`);
    } else {
      router.push('/meus-documentos');
    }
  };

  return (
    <Layout isAuthenticated>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Painel do Contribuinte</h1>
        <p className="text-gray-600 text-lg">
          Bem-vindo(a) ao seu painel, {nomeUsuario}
        </p>
      </div>
      
      {/* Alerta de sistema inativo */}
      {empresaStatus === 'INATIVO' && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <FaExclamationTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                O Contribuinte Legal encontra-se INATIVO no momento. É permitido apenas consultar seus documentos, 
                mas não será possível cadastrar novos documentos ou gerar Números da Sorte.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Acesso Rápido - Movido para o topo */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Acesso Rápido</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Botão Cadastrar Documento - Destacado */}
          {empresaStatus === 'ATIVO' ? (
            <Link href="/meus-documentos/cadastrar" className="group">
              <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 hover:from-blue-600 hover:to-blue-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 transform">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                      <FaPlus className="text-2xl" />
                    </div>
                    <FaArrowRight className="text-white/60 group-hover:text-white/80 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Cadastrar Novo Documento</h3>
                  <p className="text-blue-100 text-sm">Adicione uma nova nota fiscal ou cupom</p>
                  <div className="mt-3 inline-flex items-center text-xs font-medium bg-white/20 px-2 py-1 rounded-full">
                    ⭐ Ação Principal
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="relative overflow-hidden bg-gray-100 text-gray-500 rounded-xl p-6 cursor-not-allowed opacity-60">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <FaPlus className="text-2xl text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Cadastrar Novo Documento</h3>
              <p className="text-gray-400 text-sm">Opção indisponível no momento</p>
              <div className="mt-3 inline-flex items-center text-xs font-medium bg-gray-200 px-2 py-1 rounded-full">
                🚫 Bloqueado
              </div>
            </div>
          )}
          
          {/* Meus Documentos */}
          <Link href="/meus-documentos" className="group">
            <div className="relative overflow-hidden bg-white border border-gray-200 rounded-xl p-6 hover:border-green-300 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 transform">
              <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <FaFileAlt className="text-2xl text-green-600" />
                  </div>
                  <FaArrowRight className="text-gray-400 group-hover:text-green-600 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Meus Documentos</h3>
                <p className="text-gray-600 text-sm">Visualizar documentos cadastrados</p>
                <div className="mt-3 inline-flex items-center text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                  {estatisticas.totalDocumentos} documentos
                </div>
              </div>
            </div>
          </Link>
          
          {/* Meus Sorteios */}
          <Link href="/meus-sorteios" className="group">
            <div className="relative overflow-hidden bg-white border border-gray-200 rounded-xl p-6 hover:border-yellow-300 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 transform">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:bg-yellow-200 transition-colors">
                    <FaTrophy className="text-2xl text-yellow-600" />
                  </div>
                  <FaArrowRight className="text-gray-400 group-hover:text-yellow-600 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Meus Sorteios</h3>
                <p className="text-gray-600 text-sm">Ver números e resultados</p>
                <div className="mt-3 inline-flex items-center text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full">
                  {estatisticas.totalValidados} aptos
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
      
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white cursor-pointer hover:shadow-lg transition-all" onClick={() => navigateToDocuments()}>
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
        
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white cursor-pointer hover:shadow-lg transition-all" onClick={() => navigateToDocuments('validados')}>
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
        
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white cursor-pointer hover:shadow-lg transition-all" onClick={() => navigateToDocuments()}>
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
    </Layout>
  );
} 