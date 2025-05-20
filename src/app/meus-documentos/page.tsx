'use client';

import { useEffect, useState, Suspense } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaPlus, FaDownload, FaEye, FaFileAlt, FaMoneyBillWave, FaReceipt, FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaPrint, FaCheck, FaFileContract, FaFilter } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getUsuarioLogado } from '@/lib/auth';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';

type Documento = {
  id: string;
  usuario_id: string;
  tipo: string;
  numero_documento: string;
  data_emissao: string;
  valor: number;
  arquivo_url: string;
  numero_sorteio: string;
  status: 'VALIDADO' | 'INVÁLIDO' | 'AGUARDANDO VALIDAÇÃO';
  created_at: string;
  numerosSorte?: string[]; // Array de números da sorte associados ao documento
};

// Logo do Contribuinte Legal em base64 - versão simplificada para o PDF
const logoBase64 = 'data:image/jpeg;base64,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';

// Componente principal envolvido com Suspense
export default function MeusDocumentos() {
  return (
    <Suspense fallback={<CarregandoDocumentos />}>
      <ConteudoDocumentos />
    </Suspense>
  );
}

// Componente de carregamento
function CarregandoDocumentos() {
  return (
    <Layout isAuthenticated>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-blue-700">Meus Documentos</h1>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    </Layout>
  );
}

// Componente principal com a lógica
function ConteudoDocumentos() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [documentosFiltrados, setDocumentosFiltrados] = useState<Documento[]>([]);
  const [documentoSelecionado, setDocumentoSelecionado] = useState<Documento | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [urlArquivo, setUrlArquivo] = useState<string | null>(null);
  const [filtroAtivo, setFiltroAtivo] = useState<string | null>(null);

  useEffect(() => {
    const filter = searchParams.get('filter');
    setFiltroAtivo(filter);
    
    // Aplicar filtro nos documentos se existir
    if (documentos.length > 0) {
      aplicarFiltro(filter);
    }
  }, [searchParams, documentos]);

  const aplicarFiltro = (filtro: string | null) => {
    if (!filtro) {
      setDocumentosFiltrados(documentos);
      return;
    }

    let docsFiltered = [...documentos];
    
    if (filtro === 'validados') {
      docsFiltered = documentos.filter(doc => doc.status === 'VALIDADO');
    }
    
    setDocumentosFiltrados(docsFiltered);
  };

  const limparFiltro = () => {
    router.push('/meus-documentos');
  };

  useEffect(() => {
    const carregarDocumentos = async () => {
      try {
        const usuario = await getUsuarioLogado();
        
        if (!usuario) {
          router.push('/login');
          return;
        }
        
        const usuarioId = usuario.id;
        
        const { data: documentosData, error } = await supabase
          .from('documentos')
          .select('*')
          .eq('usuario_id', usuarioId)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Erro ao carregar documentos:', error);
          throw error;
        }
        
        const documentosFormatados = documentosData || [];
        
        // Para cada documento, buscar os números da sorte associados (se existirem)
        for (const documento of documentosFormatados) {
          if (documento.status === 'VALIDADO') {
            // Buscar números da sorte para este documento
            const { data: numerosSorteData, error: numerosSorteError } = await supabase
              .from('numeros_sorte_documento')
              .select('numero_sorte')
              .eq('documento_id', documento.id);
            
            if (!numerosSorteError && numerosSorteData) {
              // Adicionar os números da sorte ao documento
              documento.numerosSorte = numerosSorteData.map(item => item.numero_sorte);
            }
          }
        }
        
        setDocumentos(documentosFormatados);

        // Aplicar filtro inicial se existir
        const filtroInicial = searchParams.get('filter');
        if (filtroInicial) {
          aplicarFiltro(filtroInicial);
        } else {
          setDocumentosFiltrados(documentosFormatados);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setIsLoading(false);
      }
    };
    
    carregarDocumentos();
  }, [router, searchParams]);
  
  const getTipoDocumentoLabel = (tipo: string): string => {
    switch (tipo) {
      case 'nota_servico':
        return 'NOTA FISCAL DE SERVIÇO';
      case 'nota_venda':
        return 'NOTA FISCAL DE VENDA';
      case 'cupom_fiscal':
        return 'CUPOM FISCAL';
      case 'imposto':
        return 'COMPROVANTE DE PAGAMENTO DE IMPOSTO';
      default:
        return tipo.replace('_', ' ').toUpperCase();
    }
  };
  
  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'VALIDADO':
        return 'bg-green-100 text-green-800';
      case 'INVÁLIDO':
        return 'bg-red-100 text-red-800';
      case 'AGUARDANDO VALIDAÇÃO':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VALIDADO':
        return <FaCheck className="mr-2" />;
      case 'INVÁLIDO':
        return <FaTimesCircle className="mr-2" />;
      case 'AGUARDANDO VALIDAÇÃO':
        return <FaHourglassHalf className="mr-2" />;
      default:
        return null;
    }
  };

  const visualizarDocumento = async (documento: Documento) => {
    try {
      setDocumentoSelecionado(documento);
      
      // Gerar URL assinada para visualização do arquivo
      const { data, error } = await supabase.storage
        .from('documentos')
        .createSignedUrl(documento.arquivo_url, 60); // Validade de 60 segundos
      
      if (error) {
        throw error;
      }
      
      setUrlArquivo(data.signedUrl);
      setMostrarModal(true);
    } catch (error) {
      console.error('Erro ao visualizar documento:', error);
      toast.error('Não foi possível visualizar o documento');
    }
  };
  
  const fecharModal = () => {
    setMostrarModal(false);
    setUrlArquivo(null);
    setDocumentoSelecionado(null);
  };
  
  const baixarDocumento = async (documento: Documento) => {
    try {
      // Gerar URL assinada para download do arquivo
      const { data, error } = await supabase.storage
        .from('documentos')
        .createSignedUrl(documento.arquivo_url, 60); // Validade de 60 segundos
      
      if (error) {
        throw error;
      }
      
      // Criar link para download
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = `documento_${documento.numero_documento}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Download iniciado!');
    } catch (error) {
      console.error('Erro ao baixar documento:', error);
      toast.error('Não foi possível baixar o documento');
    }
  };
  
  const imprimirComprovante = (documento: Documento) => {
    try {
      // Criar novo documento PDF
      const pdf = new jsPDF();
      
      // Adicionar título
      pdf.setFontSize(20);
      pdf.text('Comprovante de Documento', 20, 20);
      
      // Adicionar logo (se necessário)
      // pdf.addImage(logoDataUrl, 'PNG', 150, 15, 40, 15);
      
      // Adicionar linha separadora
      pdf.setLineWidth(0.5);
      pdf.line(20, 25, 190, 25);
      
      // Detalhes do documento
      pdf.setFontSize(12);
      pdf.text('Detalhes do Documento', 20, 40);
      
      pdf.setFontSize(10);
      pdf.text(`Tipo: ${getTipoDocumentoLabel(documento.tipo)}`, 20, 50);
      pdf.text(`Número: ${documento.numero_documento}`, 20, 60);
      pdf.text(`Data de Emissão: ${format(new Date(documento.data_emissao), 'dd/MM/yyyy')}`, 20, 70);
      pdf.text(`Valor: R$ ${documento.valor.toFixed(2).replace('.', ',')}`, 20, 80);
      pdf.text(`Status: ${documento.status}`, 20, 90);
      pdf.text(`Data de Cadastro: ${format(new Date(documento.created_at), 'dd/MM/yyyy HH:mm')}`, 20, 100);
      
      // Adicionar informações sobre os números da sorte se o documento estiver validado
      if (documento.status === 'VALIDADO') {
        // Se temos múltiplos números da sorte
        if (documento.numerosSorte && documento.numerosSorte.length > 0) {
          pdf.text(`Números da Sorte:`, 20, 120);
          documento.numerosSorte.forEach((numero, index) => {
            pdf.text(`${index + 1}. ${numero}`, 30, 130 + (index * 10));
          });
        } else {
          // Retrocompatibilidade com o campo antigo
          pdf.text(`Número da Sorte: ${documento.numero_sorteio}`, 20, 130);
        }
      } else {
        pdf.text('Este documento ainda não possui números da sorte atribuídos.', 20, 130);
        pdf.text('Após a validação, serão gerados números da sorte conforme o valor do documento.', 20, 140);
      }
      
      // Rodapé
      pdf.setFontSize(8);
      pdf.text('Este documento é apenas um comprovante e não substitui o documento fiscal original.', 20, 250);
      pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 20, 255);
      
      // Salvar ou abrir o PDF
      pdf.save(`comprovante_${documento.numero_documento}.pdf`);
      
      toast.success('Comprovante gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar comprovante:', error);
      toast.error('Não foi possível gerar o comprovante');
    }
  };
  
  const abrirCadastro = () => {
    router.push('/meus-documentos/cadastrar');
  };

  // Função auxiliar para formatar data corretamente preservando o dia
  const formatarDataSemTimezone = (dataString: string) => {
    try {
      // Se a data vier em formato ISO, vamos preservar o dia exato
      if (dataString.includes('T')) {
        return format(parseISO(dataString), 'dd/MM/yyyy');
      }
      
      // Se for apenas data (YYYY-MM-DD), dividimos e montamos diretamente
      const [ano, mes, dia] = dataString.split('-').map(num => parseInt(num, 10));
      if (ano && mes && dia) {
        return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
      }
      
      // Fallback para o método padrão (que pode ter o problema de timezone)
      return format(new Date(dataString), 'dd/MM/yyyy');
    } catch (error) {
      console.error('Erro ao formatar data:', error, dataString);
      return dataString; // Retornar a string original em caso de erro
    }
  };

  return (
    <Layout isAuthenticated>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-700">Meus Documentos</h1>
            {filtroAtivo && (
              <div className="flex items-center mt-2">
                <span className="text-sm text-gray-600 mr-2">
                  Filtro ativo: 
                  <span className="ml-1 font-medium">
                    {filtroAtivo === 'validados' ? 'Cupons Validados' : filtroAtivo}
                  </span>
                </span>
                <button 
                  onClick={limparFiltro}
                  className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded flex items-center"
                >
                  <span>Limpar</span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={abrirCadastro}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Cadastrar Novo Documento
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : documentosFiltrados.length === 0 ? (
          <div className="bg-white shadow-md rounded-lg p-6 text-center">
            <div className="flex justify-center mb-4">
              <Image 
                src="/empty-folder.svg" 
                alt="Nenhum documento" 
                width={150} 
                height={150} 
              />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {filtroAtivo ? 'Nenhum documento encontrado com este filtro' : 'Você ainda não possui documentos cadastrados'}
            </h2>
            <p className="text-gray-600 mb-4">
              {filtroAtivo ? (
                <>
                  <button 
                    onClick={limparFiltro} 
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Remover filtro
                  </button> para ver todos os seus documentos
                </>
              ) : (
                'Cadastre seus documentos fiscais para participar dos sorteios'
              )}
            </p>
            {!filtroAtivo && (
              <button
                onClick={abrirCadastro}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                Cadastrar Meu Primeiro Documento
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                      Número(s) da Sorte
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
                  {documentosFiltrados.map((documento) => (
                    <tr key={documento.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-100 rounded-full">
                            <FaFileAlt className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{getTipoDocumentoLabel(documento.tipo)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatarDataSemTimezone(documento.data_emissao)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(documento.valor)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {documento.status === 'VALIDADO' ? (
                          <div>
                            {documento.numerosSorte && documento.numerosSorte.length > 0 ? (
                              <div className="text-sm font-medium text-gray-900">
                                <p className="font-bold text-green-600">{documento.numerosSorte.length} números:</p>
                                <div className="max-h-20 overflow-y-auto">
                                  {documento.numerosSorte.map((numero, index) => (
                                    <p key={index} className="font-medium">{numero}</p>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="font-medium">{documento.numero_sorteio}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">-</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(documento.status)}`}>
                          {getStatusIcon(documento.status)}
                          {documento.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => visualizarDocumento(documento)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Visualizar"
                          >
                            <FaEye />
                          </button>
                          <button
                            onClick={() => baixarDocumento(documento)}
                            className="text-green-600 hover:text-green-900"
                            title="Baixar"
                          >
                            <FaDownload />
                          </button>
                          <button
                            onClick={() => imprimirComprovante(documento)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Imprimir comprovante"
                          >
                            <FaPrint />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {mostrarModal && documentoSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen flex flex-col">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  {getTipoDocumentoLabel(documentoSelecionado.tipo)}
                </h2>
                <button
                  onClick={fecharModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  &times;
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto">
                {urlArquivo ? (
                  <iframe
                    src={urlArquivo}
                    className="w-full h-[70vh]"
                    title="Visualização do documento"
                  />
                ) : (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-between">
                <div className="flex items-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(documentoSelecionado.status)}`}>
                    {getStatusIcon(documentoSelecionado.status)}
                    {documentoSelecionado.status}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => baixarDocumento(documentoSelecionado)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center"
                  >
                    <FaDownload className="mr-2" /> Baixar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
} 